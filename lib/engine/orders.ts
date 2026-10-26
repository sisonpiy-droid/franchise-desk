// Assumed orders by store: a heat grid of orders per month for every store, existing and new.
// There is no order data in the file, so every number comes from the illustrative assumptions below and is shown as such.
import { idealSize } from "./assess";
import { fmtMonth } from "./plan";
import type { Policy } from "./policy";
import type { Dataset, RunResult, Tier } from "./types";

/** Orders a month for a mature store of ideal size, by city tier (illustrative). */
export const ORDERS_PER_MONTH: Record<Tier, number> = { 1: 900, 2: 650, 3: 420 };
/** A new store starts at this share of its mature volume and reaches 100% after RAMP_MONTHS (illustrative). */
export const START_SHARE = 0.35;
export const RAMP_MONTHS = 9;
/** Where the shop sits changes footfall (illustrative). */
export const FLOOR_FACTOR = { Ground: 1, Mall: 1.15, Upper: 0.6, Unknown: 0.85 } as const;
export const HORIZON = 12;

/** A relative demand index for a pin code (1 = a typical store in its tier), with a short reason. */
export type PinIndex = Record<string, { index: number; why: string }>;

export interface OrderRow {
  id: string; // ST-01 or APP-001
  pin: string | null;
  index: number; // the pin-code index used (1 when none is known)
  why: string; // why the index is what it is, when one is known
  label: string;
  kind: "existing" | "new";
  city: string;
  tier: Tier;
  key: string | null; // decision key for a new store, so a click can open it
  status: string | null;
  steady: number; // mature orders a month for this store
  cells: number[]; // orders for each of the next HORIZON months
  total: number; // sum of the cells
}

export interface OrderHeat {
  months: string[];
  rows: OrderRow[];
  max: number;
  totalByMonth: number[];
}

/** Share of mature volume after `age` full months of trading; 0 before opening. */
export function ramp(age: number): number {
  if (age < 0) return 0;
  return Math.min(1, START_SHARE + ((1 - START_SHARE) * age) / RAMP_MONTHS);
}

const monthIndex = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};
const round10 = (n: number) => Math.round(n / 10) * 10;

export function buildOrderHeat(result: RunResult, dataset: Dataset, policy: Policy, today: string, pinIndex: PinIndex = {}): OrderHeat {
  const start = monthIndex(today);
  const months = Array.from({ length: HORIZON }, (_, i) => {
    const m = start + i;
    return fmtMonth(`${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}-01`);
  });
  const tierOfCity = new Map<string, Tier>();
  for (const c of dataset.cities ?? []) tierOfCity.set(c.city, c.tier);
  for (const t of result.territories) if (t.city && t.tier) tierOfCity.set(t.city, t.tier);
  const tierOf = (city: string): Tier => tierOfCity.get(city) ?? 2;

  const rows: OrderRow[] = [];
  // existing stores trade at full volume unless they opened recently
  for (const s of dataset.stores) {
    const tier = tierOf(s.city);
    const pi = pinIndex[s.pin];
    const index = pi?.index ?? 1;
    const steady = ORDERS_PER_MONTH[tier] * index;
    const openedAt = (s.year ?? new Date(today).getUTCFullYear() - 3) * 12 + 5; // mid-year when only the year is known
    const cells = months.map((_, i) => round10(steady * ramp(start + i - openedAt)));
    rows.push({ id: s.id, pin: s.pin, index, why: pi?.why ?? "", label: `${s.id} · ${s.city}`, kind: "existing", city: s.city, tier, key: null, status: null, steady: round10(steady), cells, total: cells.reduce((a, b) => a + b, 0) });
  }
  // partners moving forward start when their onboarding plan says they open
  const appByKey = new Map(dataset.applications.map((a) => [a.key, a]));
  const cityOf = new Map(result.territories.map((t) => [t.key, t.city ?? ""]));
  for (const d of result.decisions) {
    if ((d.status !== "APPROVED" && d.status !== "CONDITIONAL") || !d.plan) continue;
    const city = (d.territoryKey && cityOf.get(d.territoryKey)) || appByKey.get(d.key)?.city || "";
    const tier = d.capex?.tier ?? tierOf(city);
    const app = appByKey.get(d.key);
    const sizeFactor = d.capex ? Math.min(1.6, Math.max(0.5, d.capex.sizeUsed / idealSize(policy, tier))) : 1;
    const floor = FLOOR_FACTOR[(app?.floor ?? "Unknown") as keyof typeof FLOOR_FACTOR] ?? FLOOR_FACTOR.Unknown;
    const pin = d.allocatedPin ?? d.pin;
    const pi = pin ? pinIndex[pin] : undefined;
    const index = pi?.index ?? 1;
    const steady = ORDERS_PER_MONTH[tier] * sizeFactor * floor * index;
    const open = monthIndex(d.plan.readyDate);
    const cells = months.map((_, i) => round10(steady * ramp(start + i - open)));
    rows.push({ id: d.id, pin: pin ?? null, index, why: pi?.why ?? "", label: `${d.id} · ${d.name || city}`, kind: "new", city, tier, key: d.key, status: d.status, steady: round10(steady), cells, total: cells.reduce((a, b) => a + b, 0) });
  }
  rows.sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
  return {
    months,
    rows,
    max: Math.max(1, ...rows.flatMap((r) => r.cells)),
    totalByMonth: months.map((_, i) => rows.reduce((n, r) => n + r.cells[i], 0)),
  };
}

/** The distinct pin codes in the heat grid, with their city and tier, for asking the model. */
export function heatAsks(result: RunResult, dataset: Dataset, policy: Policy, today: string): { pin: string; city: string; tier: number }[] {
  const seen = new Map<string, { pin: string; city: string; tier: number }>();
  for (const x of buildOrderHeat(result, dataset, policy, today).rows) if (x.pin && /^\d{6}$/.test(x.pin) && !seen.has(x.pin)) seen.set(x.pin, { pin: x.pin, city: x.city, tier: x.tier });
  return [...seen.values()];
}
