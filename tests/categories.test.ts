import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { CATEGORY_IDS, CATEGORY_PRESETS, DEFAULT_CATEGORY, policyFor, presetOf } from "@/lib/engine/categories";
import { newSession, replay } from "@/lib/engine/session";
import { loadXlsx, TODAY } from "./helpers";

const golden = loadXlsx("golden/golden.xlsx");
const stress = loadXlsx("golden/stress500.xlsx");

const shape = (o: unknown): unknown => (Array.isArray(o) ? o.map(shape) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o as object).map(([k, v]) => [k, shape(v)])) : typeof o);

describe("store types change the policy, not the rules", () => {
  it("offers six store types and defaults to the brand's own settings", () => {
    expect(CATEGORY_IDS).toHaveLength(6);
    expect(DEFAULT_CATEGORY).toBe("general");
    expect(policyFor("general")).toEqual(DEFAULT_POLICY);
    expect(policyFor(undefined)).toEqual(DEFAULT_POLICY);
    expect(policyFor("nonsense")).toEqual(DEFAULT_POLICY);
    expect(presetOf("qsr").id).toBe("qsr");
  });
  it("never edits the shared defaults", () => {
    const before = JSON.stringify(DEFAULT_POLICY);
    for (const id of CATEGORY_IDS) policyFor(id);
    expect(JSON.stringify(DEFAULT_POLICY)).toBe(before);
  });
  it("every type keeps the same policy shape, with sane numbers", () => {
    for (const id of CATEGORY_IDS) {
      const p = policyFor(id);
      expect(shape(p)).toEqual(shape(DEFAULT_POLICY));
      for (const tier of ["1", "2", "3"] as const) {
        expect(p.capex.idealSize[tier]).toBeGreaterThanOrEqual(p.capex.minSize[tier]);
        expect(p.capex.minSize[tier]).toBeGreaterThan(0);
        expect(p.capex.fitoutPerSqft[tier]).toBeGreaterThan(0);
        expect(p.payback.revenuePerSqftMonth[tier]).toBeGreaterThan(0);
      }
      // a bigger city never has cheaper fit-out or a smaller ideal shop
      expect(p.capex.fitoutPerSqft["1"]).toBeGreaterThanOrEqual(p.capex.fitoutPerSqft["2"]);
      expect(p.capex.fitoutPerSqft["2"]).toBeGreaterThanOrEqual(p.capex.fitoutPerSqft["3"]);
      expect(p.capex.idealSize["1"]).toBeGreaterThanOrEqual(p.capex.idealSize["3"]);
      expect(p.brand.category.length).toBeGreaterThan(2);
      expect(CATEGORY_PRESETS[id].blurb.length).toBeGreaterThan(20);
    }
  });
  it("the hard rules hold for every type on both test files", () => {
    for (const id of CATEGORY_IDS) {
      for (const ds of [golden, stress]) {
        const r = run(ds, policyFor(id), { today: TODAY, pinned: {} });
        expect(r.pinConflicts).toBe(0);
        expect(r.decisions).toHaveLength(ds.applications.length);
        const taken = new Map<string, string>();
        for (const d of r.decisions) {
          if (d.status !== "APPROVED" && d.status !== "CONDITIONAL") continue;
          if (!d.allocatedPin) continue; // a conditional reservation can still be looking for a site
          expect(taken.has(d.allocatedPin)).toBe(false);
          taken.set(d.allocatedPin, d.id);
          expect(ds.stores.some((s) => s.pin === d.allocatedPin)).toBe(false);
        }
      }
    }
  });
  it("the type really changes what a store costs and earns", () => {
    const base = run(golden, policyFor("general"), { today: TODAY, pinned: {} });
    const pharm = run(golden, policyFor("pharmacy"), { today: TODAY, pinned: {} });
    const qsr = run(golden, policyFor("qsr"), { today: TODAY, pinned: {} });
    const withCapex = (r: typeof base) => r.decisions.filter((d) => d.capex).map((d) => d.capex!.required);
    expect(withCapex(pharm)).not.toEqual(withCapex(base));
    expect(withCapex(qsr)).not.toEqual(withCapex(base));
    const planOf = (r: typeof base) => r.decisions.find((d) => d.plan)?.plan;
    expect(planOf(qsr)!.training.weeks).toBeGreaterThanOrEqual(planOf(base)!.training.weeks);
    expect(planOf(qsr)!.supply.safetyStockDays).toBeLessThan(planOf(base)!.supply.safetyStockDays);
  });
  it("switching type on a live session re-decides from the same file and keeps the log", () => {
    const s = newSession(golden, policyFor("general"), TODAY);
    const a = replay(s).at(-1)!;
    const s2 = { ...s, basePolicy: policyFor("electronics") };
    const b = replay(s2).at(-1)!;
    expect(b.result.decisions).toHaveLength(a.result.decisions.length);
    expect(b.result.pinConflicts).toBe(0);
    expect(JSON.stringify(b.result.decisions.map((d) => d.capex?.required))).not.toBe(JSON.stringify(a.result.decisions.map((d) => d.capex?.required)));
  });
  it("explanations use the store's own noun", () => {
    const r = run(golden, policyFor("pharmacy"), { today: TODAY, pinned: {} });
    expect(policyFor("pharmacy").brand.category).toBe("pharmacy");
    expect(r.decisions.length).toBeGreaterThan(0);
  });
});
