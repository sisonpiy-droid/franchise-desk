import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { REASON_CODES } from "@/lib/engine/codes";
import { AREAS, groupAverages, histogram, reasonLedger, ruleText, scorecard } from "@/lib/engine/rubric";
import { loadXlsx, TODAY } from "./helpers";

const files = ["golden/golden.xlsx", "golden/stress500.xlsx", "redteam/redteam.xlsx"];
const results = files.map((f) => run(loadXlsx(f), DEFAULT_POLICY, { today: TODAY, pinned: {} }));
const max = Object.fromEntries([["capital", 25], ["experience", 20], ["space", 25], ["timeline", 10], ["territory", 20]]);

describe("rubric evidence numbers", () => {
  it("the reason ledger accounts for every applicant exactly once", () => {
    for (const r of results) {
      const rows = reasonLedger(r, DEFAULT_POLICY);
      expect(rows.reduce((n, x) => n + x.count, 0)).toBe(r.decisions.length);
      expect(Math.abs(rows.reduce((n, x) => n + x.pct, 0) - 100)).toBeLessThan(0.06 * rows.length + 0.01);
      for (const x of rows) { expect(x.rule.length).toBeGreaterThan(10); expect(x.ids).toHaveLength(x.count); }
    }
  });
  it("every reason code has a written rule", () => {
    for (const c of REASON_CODES) expect(ruleText(c, DEFAULT_POLICY).length, c).toBeGreaterThan(10);
  });
  it("histogram plus unscored equals the applicants; every bin count adds up", () => {
    for (const r of results) {
      const h = histogram(r);
      expect(h.bins.reduce((n, b) => n + b.total, 0) + h.unscored).toBe(r.decisions.length);
      for (const b of h.bins) expect(Object.values(b.byStatus).reduce((a, c) => a + c, 0)).toBe(b.total);
    }
  });
  it("group averages stay inside each area's maximum and moving forward outscores declined", () => {
    for (const r of results) {
      const g = groupAverages(r);
      for (const row of g) for (const a of AREAS) { const v = row.areas[a.key]; if (v !== null) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(max[a.key]); } }
      const fw = g.find((x) => x.group === "Moving forward")!, dc = g.find((x) => x.group === "Declined")!;
      if (fw.total !== null && dc.total !== null && dc.n > 0) expect(fw.total).toBeGreaterThanOrEqual(dc.total);
    }
  });
  it("scorecard: one row per applicant, areas sum to the total, gap to the bar is exact", () => {
    for (const r of results) {
      const rows = scorecard(r);
      expect(rows).toHaveLength(r.decisions.length);
      for (const x of rows) {
        if (x.total === null) continue;
        const sum = AREAS.reduce((n, a) => n + (x.areas[a.key] ?? 0), 0);
        expect(Math.abs(sum - x.total)).toBeLessThanOrEqual(1);
        if (x.bar !== null) expect(x.vsBar).toBe(x.total - x.bar);
      }
    }
  });
});
