import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { buildOrderHeat, HORIZON, ORDERS_PER_MONTH, ramp, START_SHARE } from "@/lib/engine/orders";
import { loadXlsx, TODAY } from "./helpers";

const ds = loadXlsx("golden/golden.xlsx");
const r = run(ds, DEFAULT_POLICY, { today: TODAY, pinned: {} });
const h = buildOrderHeat(r, ds, DEFAULT_POLICY, TODAY);

describe("assumed orders by store", () => {
  it("ramp is zero before opening, starts at the start share, and tops out at 100%", () => {
    expect(ramp(-1)).toBe(0);
    expect(ramp(0)).toBeCloseTo(START_SHARE, 5);
    expect(ramp(100)).toBe(1);
    for (let a = 0; a < 20; a++) expect(ramp(a + 1)).toBeGreaterThanOrEqual(ramp(a));
  });
  it("has a row for every existing store and every partner moving forward", () => {
    const moving = r.decisions.filter((d) => (d.status === "APPROVED" || d.status === "CONDITIONAL") && d.plan).length;
    expect(h.rows.filter((x) => x.kind === "existing")).toHaveLength(ds.stores.length);
    expect(h.rows.filter((x) => x.kind === "new")).toHaveLength(moving);
    expect(h.months).toHaveLength(HORIZON);
  });
  it("no store ever shows more than its mature volume, and volumes never fall for a store that has opened", () => {
    for (const x of h.rows) {
      expect(x.cells).toHaveLength(HORIZON);
      for (const c of x.cells) expect(c).toBeLessThanOrEqual(x.steady + 10);
      for (let i = 1; i < x.cells.length; i++) expect(x.cells[i]).toBeGreaterThanOrEqual(x.cells[i - 1]);
    }
  });
  it("long-open stores run at full tier volume", () => {
    const old = h.rows.find((x) => x.kind === "existing")!;
    const tierVol = ORDERS_PER_MONTH[old.tier];
    expect(Math.abs(old.cells[HORIZON - 1] - tierVol)).toBeLessThanOrEqual(10);
  });
  it("rows are sorted by total orders, and the totals add up", () => {
    for (let i = 1; i < h.rows.length; i++) expect(h.rows[i].total).toBeLessThanOrEqual(h.rows[i - 1].total);
    for (let m = 0; m < HORIZON; m++) expect(h.totalByMonth[m]).toBe(h.rows.reduce((n, x) => n + x.cells[m], 0));
    expect(h.max).toBe(Math.max(...h.rows.flatMap((x) => x.cells)));
  });
});
