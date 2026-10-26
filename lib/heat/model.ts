// Pincode heat: asks the model how busy a typical store on a pin code would be compared with a typical store in its city tier.
// The model only suggests a relative index and a short reason. The browser multiplies it into an illustrative order count;
// no decision (approve, hold, decline) ever reads it. Only the pin code, city and tier are sent: no names, notes or scores.

export const MIN_INDEX = 0.5;
export const MAX_INDEX = 1.5;

export interface HeatAsk {
  pin: string;
  city: string;
  tier: number;
}
export interface HeatIndex {
  index: number; // 1 = a typical store in this tier; 1.3 = busier; 0.7 = quieter
  why: string;
}

export const HEAT_SCHEMA = {
  type: "OBJECT",
  properties: {
    pins: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { pin: { type: "STRING" }, index: { type: "NUMBER" }, why: { type: "STRING" } },
        required: ["pin", "index", "why"],
      },
    },
  },
  required: ["pins"],
};

export const HEAT_SYSTEM =
  "You help a retail expansion team sanity-check demand by Indian pin code. For each pin code, return a relative demand index for one retail store: " +
  `1.0 is a typical store in a city of the same tier, ${MAX_INDEX} is a clearly busier area (dense retail, offices, colleges, transit), ${MIN_INDEX} is clearly quieter (sparse, outskirts, industrial). ` +
  "Use what you know about the area the pin code covers. If you do not recognise a pin code, return 1.0 and say so. " +
  "The reason is one short sentence of at most 14 words, naming the kind of area. Use the whole range: only about one pin in five should be above 1.25 or below 0.75, and most should sit between 0.85 and 1.2. Never invent statistics or numbers of people. This is a rough planning guess, not data.";

export function buildHeatPrompt(items: HeatAsk[]): string {
  return `Estimate the demand index for each pin code.\n${items.map((i) => `${i.pin} | ${i.city} | Tier ${i.tier}`).join("\n")}`;
}

const clean = (s: string) => s.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);

/** Keeps only the pins that were asked about, clamps every index, and trims the reasons. Anything else is dropped. */
export function normaliseHeat(raw: unknown, asked: string[]): Record<string, HeatIndex> {
  const out: Record<string, HeatIndex> = {};
  const want = new Set(asked);
  const arr = raw && typeof raw === "object" && Array.isArray((raw as { pins?: unknown }).pins) ? ((raw as { pins: unknown[] }).pins as unknown[]) : [];
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const r = row as { pin?: unknown; index?: unknown; why?: unknown };
    const pin = typeof r.pin === "string" ? r.pin.trim() : "";
    const n = typeof r.index === "number" ? r.index : Number(r.index);
    if (!want.has(pin) || !Number.isFinite(n)) continue;
    out[pin] = { index: Math.round(Math.min(MAX_INDEX, Math.max(MIN_INDEX, n)) * 100) / 100, why: typeof r.why === "string" ? clean(r.why) : "" };
  }
  return out;
}
