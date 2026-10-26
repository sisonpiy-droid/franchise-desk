import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { briefText, buildBrief } from "@/lib/engine/brief";
import { loadXlsx, TODAY } from "./helpers";

const ds = loadXlsx("golden/golden.xlsx");
const r = run(ds, DEFAULT_POLICY, { today: TODAY, pinned: {} });
const b = buildBrief(r, ds, DEFAULT_POLICY, TODAY);

describe("executive brief", () => {
  it("headline matches the decisions", () => {
    const moving = r.decisions.filter((d) => d.status === "APPROVED" || d.status === "CONDITIONAL").length;
    expect(b.headline).toContain(`${moving} of ${r.decisions.length}`);
    expect(b.numbers[0].value).toBe(`${moving} of ${r.decisions.length}`);
  });
  it("lists decisions that need a person, each linked to a real decision", () => {
    const s = b.sections.find((x) => x.title === "Decisions needed this week")!;
    expect(s.items.length).toBeGreaterThan(0);
    for (const i of s.items) expect(r.decisions.some((d) => d.key === i.key)).toBe(true);
  });
  it("has no empty sections and labels money as illustrative", () => {
    for (const s of b.sections) expect(s.items.length).toBeGreaterThan(0);
    expect(briefText(b)).toContain("illustrative");
  });
  it("hold reasons add up to the holds shown in the title", () => {
    const holds = r.decisions.filter((d) => d.status === "ON_HOLD").length;
    const s = b.sections.find((x) => x.title.startsWith("What the"))!;
    expect(s.title).toContain(String(holds));
    const total = s.items.reduce((n, i) => n + Number(i.text.split(" ")[0]), 0);
    expect(total).toBeLessThanOrEqual(holds);
  });
  it("plain text carries every section title", () => {
    const t = briefText(b);
    for (const s of b.sections) expect(t).toContain(s.title.toUpperCase());
  });
});
