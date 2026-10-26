import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { plainReason, VERDICT_WORD } from "@/lib/engine/plain";
import { loadXlsx, TODAY } from "./helpers";

const files = ["golden/golden.xlsx", "golden/stress500.xlsx", "redteam/redteam.xlsx"];
const results = files.map((f) => run(loadXlsx(f), DEFAULT_POLICY, { today: TODAY, pinned: {} }));

describe("plain-English verdicts", () => {
  it("every decision has a readable reason: no raw codes, no placeholders, one short sentence group", () => {
    for (const r of results) {
      for (const d of r.decisions) {
        const t = plainReason(d);
        expect(t.length, d.id).toBeGreaterThan(15);
        expect(t.length, d.id).toBeLessThan(260);
        expect(t, d.id).not.toMatch(/undefined|NaN|null|\[object|[A-Z]{3,}_[A-Z_]{3,}/);
        expect(VERDICT_WORD[d.status].length).toBeGreaterThan(4);
      }
    }
  });
  it("approvals say why in numbers and a hold on a taken pin names the one-store-per-pin rule", () => {
    const all = results.flatMap((r) => r.decisions);
    const approved = all.find((d) => d.status === "APPROVED" && d.capex?.invest != null)!;
    expect(plainReason(approved)).toMatch(/scored \d+ out of 100/);
    const taken = all.find((d) => d.status === "ON_HOLD" && d.codes[0] === "PIN_HAS_STORE");
    if (taken) expect(plainReason(taken)).toMatch(/one store per pincode/);
  });
  it("waitlisted by a stronger applicant says so", () => {
    const w = results.flatMap((r) => r.decisions).find((d) => d.status === "WAITLISTED" && d.codes[0] === "PIN_TAKEN");
    if (w) expect(plainReason(w)).toMatch(/scored higher/);
  });
});
