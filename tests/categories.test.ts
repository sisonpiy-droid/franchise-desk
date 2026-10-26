import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { CATEGORIES, CATEGORY_IDS, DEFAULT_CATEGORY, categoryOf } from "@/lib/engine/categories";
import { buildOrderHeat, HORIZON } from "@/lib/engine/orders";
import { buildHeatPrompt, heatSystemFor } from "@/lib/heat/model";
import { loadXlsx, TODAY } from "./helpers";

const ds = loadXlsx("golden/golden.xlsx");
const r = run(ds, DEFAULT_POLICY, { today: TODAY, pinned: {} });

describe("store categories", () => {
  it("offers six categories, each with sane assumptions", () => {
    expect(CATEGORY_IDS).toHaveLength(6);
    for (const id of CATEGORY_IDS) {
      const c = CATEGORIES[id];
      expect(c.label.length).toBeGreaterThan(3);
      expect(c.drivers.length).toBeGreaterThan(20);
      expect(c.startShare).toBeGreaterThan(0);
      expect(c.startShare).toBeLessThan(1);
      expect(c.rampMonths).toBeGreaterThan(0);
      // a bigger city never takes fewer orders, and a bigger city never has a smaller typical shop
      expect(c.ordersPerMonth[1]).toBeGreaterThan(c.ordersPerMonth[2]);
      expect(c.ordersPerMonth[2]).toBeGreaterThan(c.ordersPerMonth[3]);
      expect(c.typicalSize[1]).toBeGreaterThanOrEqual(c.typicalSize[2]);
      expect(c.typicalSize[2]).toBeGreaterThanOrEqual(c.typicalSize[3]);
      // an upper floor never beats the ground floor
      expect(c.floor.Upper).toBeLessThan(c.floor.Ground);
    }
  });
  it("an unknown or missing category falls back to the default", () => {
    expect(categoryOf(undefined).id).toBe(DEFAULT_CATEGORY);
    expect(categoryOf("nonsense").id).toBe(DEFAULT_CATEGORY);
    expect(categoryOf("qsr").id).toBe("qsr");
  });
  it("changing the category changes the grid, not who is in it", () => {
    const base = buildOrderHeat(r, ds, DEFAULT_POLICY, TODAY, {}, "general");
    const qsr = buildOrderHeat(r, ds, DEFAULT_POLICY, TODAY, {}, "qsr");
    expect(qsr.category).toBe("qsr");
    expect(qsr.rows.map((x) => x.id).sort()).toEqual(base.rows.map((x) => x.id).sort());
    expect(qsr.max).toBeGreaterThan(base.max);
    for (const id of CATEGORY_IDS) {
      const h = buildOrderHeat(r, ds, DEFAULT_POLICY, TODAY, {}, id);
      for (const row of h.rows) {
        expect(row.cells).toHaveLength(HORIZON);
        for (const c of row.cells) expect(c).toBeLessThanOrEqual(row.steady + 10);
      }
    }
  });
  it("a faster-ramping category reaches full volume sooner for a new store", () => {
    const pick = (id: Parameters<typeof buildOrderHeat>[5]) => buildOrderHeat(r, ds, DEFAULT_POLICY, TODAY, {}, id).rows.find((x) => x.kind === "new")!;
    const q = pick("qsr");
    const a = pick("apparel");
    const share = (row: ReturnType<typeof pick>) => row.cells.filter((c) => c > 0 && c >= row.steady * 0.95).length;
    expect(share(q)).toBeGreaterThanOrEqual(share(a));
  });
  it("the model is told the store type and what drives demand, still without names or notes", () => {
    const sys = heatSystemFor("pharmacy");
    expect(sys).toContain("pharmacy");
    expect(sys).toContain(CATEGORIES.pharmacy.drivers);
    expect(heatSystemFor("qsr")).not.toBe(heatSystemFor("pharmacy"));
    const prompt = buildHeatPrompt([{ pin: "560001", city: "Bengaluru", tier: 1 }], "qsr");
    expect(prompt).toContain("quick-service restaurant");
    for (const a of ds.applications) expect(prompt).not.toContain(a.name);
  });
});
