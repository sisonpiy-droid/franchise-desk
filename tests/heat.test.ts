import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { HEAT_SYSTEM, MAX_INDEX, MIN_INDEX, buildHeatPrompt, normaliseHeat } from "@/lib/heat/model";
import { buildOrderHeat, heatAsks } from "@/lib/engine/orders";
import { loadXlsx, TODAY } from "./helpers";

const ds = loadXlsx("golden/golden.xlsx");
const r = run(ds, DEFAULT_POLICY, { today: TODAY, pinned: {} });

describe("pin-code heat from the model", () => {
  it("keeps only the pins asked about and clamps every index", () => {
    const got = normaliseHeat({ pins: [{ pin: "560001", index: 9, why: "Dense retail core." }, { pin: "560002", index: -3, why: "x" }, { pin: "999999", index: 1.2, why: "not asked" }, { pin: "560003", index: "abc", why: "bad" }] }, ["560001", "560002", "560003"]);
    expect(Object.keys(got).sort()).toEqual(["560001", "560002"]);
    expect(got["560001"].index).toBe(MAX_INDEX);
    expect(got["560002"].index).toBe(MIN_INDEX);
  });
  it("survives junk answers without throwing", () => {
    for (const junk of [null, undefined, 5, "x", {}, { pins: "no" }, { pins: [null, 3, "a"] }]) expect(normaliseHeat(junk, ["560001"])).toEqual({});
  });
  it("trims and cleans the reason text", () => {
    const got = normaliseHeat({ pins: [{ pin: "560001", index: 1, why: "<b>Busy</b>\n\n" + "a".repeat(300) }] }, ["560001"]);
    expect(got["560001"].why.length).toBeLessThanOrEqual(120);
    expect(got["560001"].why).not.toMatch(/[<>\n]/);
  });
  it("sends only pin, city and tier, never names or notes", () => {
    const asks = heatAsks(r, ds, DEFAULT_POLICY, TODAY);
    const prompt = buildHeatPrompt(asks);
    expect(asks.length).toBeGreaterThan(0);
    for (const a of ds.applications) {
      expect(prompt).not.toContain(a.name);
      if (a.notes) expect(prompt).not.toContain(a.notes);
    }
    expect(HEAT_SYSTEM).toMatch(/not data/);
  });
  it("a pin-code index scales a store's mature volume, and no index leaves the tier average", () => {
    const base = buildOrderHeat(r, ds, DEFAULT_POLICY, TODAY);
    const pin = base.rows.find((x) => x.pin)!.pin!;
    const hot = buildOrderHeat(r, ds, DEFAULT_POLICY, TODAY, { [pin]: { index: 1.5, why: "Busy" } });
    for (const row of hot.rows) {
      const b = base.rows.find((x) => x.id === row.id)!;
      if (row.pin === pin) expect(row.steady).toBeGreaterThanOrEqual(Math.round(b.steady * 1.4 / 10) * 10 - 10);
      else expect(row.steady).toBe(b.steady);
    }
    expect(base.rows.every((x) => x.index === 1)).toBe(true);
  });
});
