import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "@/lib/engine";
import { newSession, replay, statusOrder } from "@/lib/engine/session";
import { FIX_LOOKUP_LIMIT, FIX_LOOKUP_LIMIT_LARGE, partnerShortlist, territoryRanking, type TerritoryVerdict } from "@/lib/engine/strategy";
import { loadXlsx, TODAY } from "./helpers";

const stepOf = (rel: string) => replay(newSession(loadXlsx(rel), DEFAULT_POLICY, TODAY)).at(-1)!;
const golden = stepOf("golden/golden.xlsx");
const stress = stepOf("golden/stress500.xlsx");
const ORDER: TerritoryVerdict[] = ["expand", "recruit", "hold", "blocked", "full"];

describe("where to expand: territory ranking", () => {
  for (const [name, step] of [["golden", golden], ["stress500", stress]] as const) {
    it(`${name}: one row per territory, each verdict matches its written rule`, () => {
      const rows = territoryRanking(step);
      expect(rows).toHaveLength(step.result.territories.length);
      for (const r of rows) {
        expect(r.reason.length).toBeGreaterThan(10);
        expect(r.remaining).toBe(Math.max(0, r.usable - r.taken));
        if (r.verdict === "blocked") expect(r.usable === 0 && r.slots > 0).toBe(true);
        if (r.verdict === "full") expect(r.remaining).toBe(0);
        if (r.verdict === "expand") expect(r.remaining > 0 && r.waiting > 0).toBe(true);
        if (r.verdict === "recruit") expect(r.remaining > 0 && r.waiting === 0).toBe(true);
      }
    });
    it(`${name}: verdict groups come in the documented order`, () => {
      const idx = territoryRanking(step).map((r) => ORDER.indexOf(r.verdict));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
    });
  }
  it("high-priority territories come before low-priority ones within a verdict", () => {
    const rows = territoryRanking(golden);
    const P: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    for (let i = 1; i < rows.length; i++) if (rows[i].verdict === rows[i - 1].verdict) expect(P[rows[i - 1].priority ?? "Low"]).toBeLessThanOrEqual(P[rows[i].priority ?? "Low"]);
  });
  it("a territory mostly inside high-overlap catchments is held back, not expanded", () => {
    const open = territoryRanking(stress).find((r) => (r.verdict === "expand") && r.applicants > 0)!;
    expect(open).toBeTruthy();
    const fake = { storeId: "ST-00", pin: "000000", year: null, km: 0.5, pinGap: 0, basis: "km" as const, risk: "high" as const, weight: 1, penalty: 0 };
    const decisions = stress.result.decisions.map((d) => (d.territoryKey === open.key && d.status !== "WITHDRAWN" ? { ...d, nearest: fake } : d));
    const held = territoryRanking({ ...stress, result: { ...stress.result, decisions } }).find((r) => r.key === open.key)!;
    expect(held.verdict).toBe("hold");
  });
  it("is deterministic", () => expect(JSON.stringify(territoryRanking(golden))).toBe(JSON.stringify(territoryRanking(golden))));
});

describe("who to invest in: partner shortlist", () => {
  const s = partnerShortlist(golden, TODAY);
  it("invest group holds only partners the hard rules allow, shortest payback first", () => {
    expect(s.invest.length).toBeGreaterThan(0);
    for (const r of s.invest) expect(["APPROVED", "CONDITIONAL"]).toContain(r.status);
    const pb = s.invest.map((r) => r.paybackMonths ?? 1e9);
    expect(pb).toEqual([...pb].sort((a, b) => a - b));
  });
  it("walk-away group is exactly the declined applicants", () => {
    const declined = golden.result.decisions.filter((d) => d.status === "DECLINED").map((d) => d.key).sort();
    expect(s.walk.map((r) => r.key).sort()).toEqual(declined);
  });
  it("every fix really improves the status, and the lookup is capped", () => {
    expect(s.fix.length).toBeLessThanOrEqual(FIX_LOOKUP_LIMIT);
    expect(partnerShortlist(stress, TODAY).fix.length).toBeLessThanOrEqual(FIX_LOOKUP_LIMIT_LARGE);
    for (const r of s.fix) {
      expect(r.fix && r.fix.length > 3).toBe(true);
      expect(statusOrder(r.fixTo!)).toBeGreaterThan(statusOrder(r.status));
    }
  });
  it("groups never share an applicant", () => {
    const all = [...s.invest, ...s.fix, ...s.walk].map((r) => r.key);
    expect(new Set(all).size).toBe(all.length);
  });
  it("funds gap is declared minus estimated need", () => {
    for (const r of s.invest) if (r.fundsGap !== null) expect(r.fundsGap).toBeCloseTo((r.invest ?? 0) - (r.required ?? 0), 0);
  });
  it("is deterministic and fast enough on 500 rows", () => {
    expect(JSON.stringify(partnerShortlist(golden, TODAY))).toBe(JSON.stringify(s));
    const t = Date.now();
    partnerShortlist(stress, TODAY);
    expect(Date.now() - t).toBeLessThan(15000);
  });
});
