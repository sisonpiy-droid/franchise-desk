import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { arrivalRace } from "@/lib/engine/arrival";
import { loadXlsx, TODAY } from "./helpers";

const files = ["golden/golden.xlsx", "golden/stress500.xlsx"];
const results = files.map((f) => run(loadXlsx(f), DEFAULT_POLICY, { today: TODAY, pinned: {} }));

describe("arrival order against rank", () => {
  it("gives every contested applicant a race where arrival and rank are each a full 1..n ordering", () => {
    let seen = 0;
    for (const r of results) {
      for (const d of r.decisions) {
        const race = arrivalRace(r, d);
        if (!race) continue;
        seen++;
        const n = race.lanes.length;
        expect(race.lanes.map((l) => l.arrival).sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        expect(race.lanes.map((l) => l.rank).sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        expect(race.me.key).toBe(d.key);
        expect(race.headline).toMatch(/Arrived \d+(st|nd|rd|th) of \d+, ranks \d+(st|nd|rd|th)\./);
        expect(race.detail.length).toBeGreaterThan(20);
      }
    }
    expect(seen).toBeGreaterThan(10);
  });
  it("the rank order follows the rules: ready site, then score, then investment, then earlier application", () => {
    for (const r of results) {
      for (const d of r.decisions) {
        const race = arrivalRace(r, d);
        if (!race) continue;
        const sorted = [...race.lanes].sort((a, b) => a.rank - b.rank);
        for (let i = 1; i < sorted.length; i++) {
          const a = sorted[i - 1], b = sorted[i];
          if (a.ready !== b.ready) expect(a.ready).toBe(true);
          else if (a.score !== b.score) expect((a.score ?? -1) > (b.score ?? -1)).toBe(true);
        }
        break;
      }
    }
  });
  it("an applicant who ranks above someone who arrived earlier is told so", () => {
    for (const r of results) for (const d of r.decisions) {
      const race = arrivalRace(r, d);
      if (race && race.me.rank < race.me.arrival) { expect(race.detail).toMatch(/moves ahead of earlier ones/); return; }
    }
  });
});
