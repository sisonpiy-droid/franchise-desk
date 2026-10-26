import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { plainReason } from "@/lib/engine/plain";
import { parseWorkbook } from "@/lib/parse/parse";
import { readWorkbook } from "@/lib/parse/xlsx";
import { TODAY } from "./helpers";

const ds = parseWorkbook(readWorkbook(new Uint8Array(readFileSync(path.resolve(__dirname, "../public/sample/edge-cases-judge-test.xlsx")))), "edge-cases-judge-test.xlsx", "upload");
const r = run(ds, DEFAULT_POLICY, { today: TODAY, pinned: {} });
const status = (id: string) => r.decisions.find((d) => d.id.replace(/\s+/g, "").toUpperCase() === id)?.status;
const code = (id: string) => r.decisions.find((d) => d.id === id)?.codes[0];

describe("the judge edge-case workbook", () => {
  it("loads without errors and decides every row, never crashing", () => {
    expect(ds.notes.filter((n) => n.severity === "error")).toHaveLength(0);
    expect(ds.applications.length).toBeGreaterThan(100);
    expect(r.decisions).toHaveLength(ds.applications.length);
    for (const d of r.decisions) expect(plainReason(d).length).toBeGreaterThan(10);
  });
  it("the hard rules hold: no pin is given to two partners and no slot is over-used", () => {
    expect(r.pinConflicts).toBe(0);
    const taken = new Map<string, string>();
    for (const d of r.decisions) if ((d.status === "APPROVED" || d.status === "CONDITIONAL") && d.allocatedPin) {
      expect(taken.has(d.allocatedPin)).toBe(false);
      taken.set(d.allocatedPin, d.id);
      expect(ds.stores.some((s) => s.pin === d.allocatedPin)).toBe(false);
    }
    for (const t of r.territories) expect(t.approved.length + t.conditional.length).toBeLessThanOrEqual(t.effectiveCapacity);
  });
  it("bad pins and bad money hold with the right reason, never guess", () => {
    expect(code("APP-031")).toBe("PIN_INVALID");
    expect(code("APP-034")).toBe("PIN_MISSING");
    expect(code("APP-036")).toBe("CITY_PIN_MISMATCH");
    expect(status("APP-044")).toBe("ON_HOLD");
    expect(status("APP-045")).toBe("ON_HOLD");
    expect(code("APP-048")).toBe("UNIT_ERROR");
    expect(status("APP-024")).toBe("DECLINED");
    expect(code("APP-052")).toBe("INVEST_LOW");
  });
  it("our own stores' pins are never given away", () => {
    expect(["ON_HOLD", "DECLINED"]).toContain(status("APP-018"));
    expect(code("APP-020")).toBe("PIN_HAS_STORE");
  });
  it("prompt injection in any language does not change the outcome path", () => {
    for (const id of ["APP-083", "APP-084", "APP-085"]) {
      const d = r.decisions.find((x) => x.id === id)!;
      expect(d.flags.some((f) => f.code === "INJECTION")).toBe(true);
      expect(d.score).not.toBeNull();
    }
  });
  it("conflicting duplicate IDs are held, exact duplicates counted once", () => {
    expect(r.decisions.filter((d) => d.id.startsWith("APP-110")).every((d) => d.status === "ON_HOLD")).toBe(true);
    expect(r.decisions.filter((d) => d.id === "APP-109")).toHaveLength(1);
  });
  it("territory sheet problems are reported, not hidden", () => {
    const msgs = ds.notes.map((n) => n.message).join(" | ");
    expect(msgs).toMatch(/56OO12/);
    expect(msgs).toMatch(/590008 590009/);
    expect(msgs).toMatch(/560008 appears in TER-01 and TER-11/);
    expect(msgs).toMatch(/already has our store/);
  });
});
