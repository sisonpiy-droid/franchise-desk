import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { spansIndia, territoryZones } from "@/lib/map/zones";
import { territoryPoints } from "@/lib/map/terrain";
import { loadXlsx, TODAY } from "./helpers";

const india = JSON.parse(readFileSync(path.resolve(__dirname, "../public/geo/india.json"), "utf8"));
const indiaFeature = india.features.find((f: GeoJSON.Feature) => f.properties?.kind === "india");
const kaFeature = india.features.find((f: GeoJSON.Feature) => f.properties?.kind === "karnataka");

describe("territory zones follow the data, not just Karnataka", () => {
  const ka = territoryPoints(run(loadXlsx("golden/golden.xlsx"), DEFAULT_POLICY, { today: TODAY, pinned: {} }));
  it("a Karnataka-only file keeps the Karnataka outline", () => {
    expect(spansIndia(ka)).toBe(false);
    const z = territoryZones(ka, kaFeature, indiaFeature);
    expect(z.features.filter((f) => f.properties?.kind === "zone")).toHaveLength(ka.filter((p) => !p.muted && !p.passive).length);
    expect(JSON.stringify(z.features.find((f) => f.properties?.kind === "zone-clip")!.geometry)).toBe(JSON.stringify(kaFeature.geometry));
  });
  it("territories in other states switch the zones to the India outline and cover the whole country", () => {
    const wide = [...ka, { key: "t:mumbai", title: "TER-90", place: "Mumbai", lngLat: [72.88, 19.08] as [number, number] }, { key: "t:delhi", title: "TER-91", place: "Delhi", lngLat: [77.21, 28.61] as [number, number] }];
    expect(spansIndia(wide)).toBe(true);
    const z = territoryZones(wide, kaFeature, indiaFeature);
    const zones = z.features.filter((f) => f.properties?.kind === "zone");
    expect(zones).toHaveLength(wide.filter((p) => !p.muted && !p.passive).length);
    expect(JSON.stringify(z.features.find((f) => f.properties?.kind === "zone-clip")!.geometry)).toBe(JSON.stringify(indiaFeature.geometry));
    // a zone exists for Delhi, far north of Karnataka's old box
    const delhi = zones.find((f) => f.properties?.key === "t:delhi")!;
    const ys = (delhi.geometry as GeoJSON.Polygon).coordinates[0].map((p) => p[1]);
    expect(Math.max(...ys)).toBeGreaterThan(30);
  });
});
