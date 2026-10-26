// Territory zones for the 3D maps: Karnataka split by nearest territory, so each territory reads as an area
// with a border. The file defines territories by pin codes, not boundaries, so these zones are an approximation
// (every place is given to its closest territory centre) and the map key says so.
import { Delaunay } from "d3-delaunay";
import type { MapPoint } from "./terrain";

let karnataka: GeoJSON.Feature | null = null;
let indiaOutline: GeoJSON.Feature | null = null;

// Karnataka's bounding box, and the box used when territories sit in several states
const KA_BOX: [number, number, number, number] = [73.5, 11.0, 79.0, 18.8];
const INDIA_BOX: [number, number, number, number] = [67.5, 6.0, 98.5, 37.5];

/** True when any territory sits outside Karnataka, so the zones must cover the whole country. */
export function spansIndia(points: MapPoint[]): boolean {
  return points.some((p) => !p.muted && !p.passive && (p.lngLat[0] < KA_BOX[0] || p.lngLat[0] > KA_BOX[2] || p.lngLat[1] < KA_BOX[1] || p.lngLat[1] > KA_BOX[3]));
}

/** The India outline from the bundled file (loaded once). */
export async function loadIndia(): Promise<GeoJSON.Feature | null> {
  if (indiaOutline) return indiaOutline;
  try {
    const india = await fetch("/geo/india.json").then((r) => r.json());
    indiaOutline = india.features.find((f: GeoJSON.Feature) => f.properties?.kind === "india") ?? null;
  } catch {
    indiaOutline = null;
  }
  return indiaOutline;
}

/** The Karnataka outline from the bundled India file (loaded once). */
export async function loadKarnataka(): Promise<GeoJSON.Feature | null> {
  if (karnataka) return karnataka;
  try {
    const india = await fetch("/geo/india.json").then((r) => r.json());
    karnataka = india.features.find((f: GeoJSON.Feature) => f.properties?.kind === "karnataka") ?? null;
  } catch {
    karnataka = null;
  }
  return karnataka;
}

export function territoryZones(points: MapPoint[], outline: GeoJSON.Feature | null, india: GeoJSON.Feature | null = null): GeoJSON.FeatureCollection {
  const centres = points.filter((p) => !p.muted && !p.passive);
  const features: GeoJSON.Feature[] = [];
  // territories in several states: split the whole country, and clip to India, not Karnataka
  const wide = spansIndia(points);
  const clip = wide ? india : outline;
  if (clip) features.push({ ...clip, properties: { kind: "zone-clip" } });
  if (centres.length >= 2) {
    const pts = centres.map((p) => p.lngLat);
    const vor = Delaunay.from(pts).voronoi(wide ? INDIA_BOX : KA_BOX);
    centres.forEach((p, i) => {
      const cell = vor.cellPolygon(i);
      if (cell) features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [cell as GeoJSON.Position[]] }, properties: { kind: "zone", key: p.key } });
    });
  }
  return { type: "FeatureCollection", features };
}
