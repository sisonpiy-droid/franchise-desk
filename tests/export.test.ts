import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { buildExport } from "@/lib/export";
import { parseWorkbook } from "@/lib/parse/parse";
import { readWorkbook } from "@/lib/parse/xlsx";
import type { Dataset } from "@/lib/engine/types";
import { loadXlsx, TODAY } from "./helpers";

const FIX = ["golden/golden.xlsx", "golden/stress500.xlsx", "redteam/redteam.xlsx"];

function roundTrip(ds: Dataset): { re: Dataset; names: string[] } {
  const r = run(ds, DEFAULT_POLICY, { today: TODAY, pinned: {} });
  const wb = buildExport(ds, r, []);
  const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  return { re: parseWorkbook(readWorkbook(bytes), "again.xlsx", "upload"), names: wb.SheetNames };
}
const appView = (d: Dataset) => d.applications.map((a) => [a.id, a.name, a.city, a.state, a.pin, a.invest, a.experience, a.business, a.space, a.size, a.floor, a.targetMonths, a.language, a.notes]);
const terView = (d: Dataset) => d.territories.map((t) => [t.id, t.city, t.state, t.pins, t.tier, t.slots, t.priority]);

describe("export is the same format as the import", () => {
  for (const f of FIX) {
    it(`${f}: exported file re-imports to the same data and the same decisions`, () => {
      const ds = loadXlsx(f, "upload");
      const { re, names } = roundTrip(ds);
      expect(names.slice(0, 4)).toEqual(["Applications", "Territories", "Existing stores", "Allowed values"]);
      expect(re.applications.length).toBe(ds.applications.length);
      expect(appView(re)).toEqual(appView(ds));
      expect(terView(re)).toEqual(terView(ds));
      expect(re.stores.map((s) => [s.id, s.city, s.pin, s.year])).toEqual(ds.stores.map((s) => [s.id, s.city, s.pin, s.year]));
      expect(re.cities).toEqual(ds.cities);
      // the red-team file has deliberately repeated IDs; the import renames them (RT-1#2), so only its data is compared
      if (f.startsWith("redteam")) return;
      const a = run(ds, DEFAULT_POLICY, { today: TODAY, pinned: {} });
      const b = run(re, DEFAULT_POLICY, { today: TODAY, pinned: {} });
      expect(b.decisions.map((d) => [d.key, d.status, d.score?.total ?? null, d.allocatedPin])).toEqual(a.decisions.map((d) => [d.key, d.status, d.score?.total ?? null, d.allocatedPin]));
    });
  }
  it("an update made in the desk is in the exported file", () => {
    const ds = loadXlsx("golden/golden.xlsx", "upload");
    const edited: Dataset = {
      ...ds,
      applications: ds.applications.map((a, i) => (i === 3 ? { ...a, space: "Owned", size: 480, floor: "Ground" } : a)),
      territories: ds.territories.map((t, i) => (i === 0 ? { ...t, slots: (t.slots ?? 0) + 1 } : t)),
    };
    const { re } = roundTrip(edited);
    expect(re.applications[3].space).toBe("Owned");
    expect(re.applications[3].size).toBe(480);
    expect(re.territories[0].slots).toBe(edited.territories[0].slots);
  });
  it("the result sheets are still there, after the input sheets", () => {
    const ds = loadXlsx("golden/golden.xlsx", "upload");
    const { names } = roundTrip(ds);
    for (const n of ["Decisions", "Plans", "Territory summary", "Data notes", "Audit log"]) expect(names).toContain(n);
  });
});
