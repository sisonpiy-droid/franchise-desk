// Store types. The Excel file does not say what kind of store the brand sells, so the user picks one and the whole
// policy follows: what a store costs to fit out and stock, how big it is, what it earns, how long fit-out and training take,
// how much stock to hold. Every number is an illustrative planning assumption, not market data, editable in the Policy panel
// like any other setting. "General store" leaves the brand's original defaults untouched.
import { clonePolicy, type Policy } from "./policy";
import { DEFAULT_POLICY } from "./policy";

export type CategoryId = "qsr" | "general" | "pharmacy" | "apparel" | "electronics" | "eyewear";
type ByTier = { "1": number; "2": number; "3": number };

export interface CategoryPreset {
  id: CategoryId;
  label: string;
  /** Wording used in explanations ("a pharmacy", "this store"). */
  noun: string;
  blurb: string;
  /** Typical bill in rupees, only used to turn estimated sales into an estimated footfall. Illustrative. */
  ticketRs: number;
  capex?: Partial<{ fitoutPerSqft: ByTier; stockPerSqft: ByTier; franchiseFeeLakh: ByTier; idealSize: ByTier; minSize: ByTier }>;
  payback?: Partial<{ revenuePerSqftMonth: ByTier; grossMarginPct: number; royaltyPct: number; otherOpexPct: number; staffCostLakhMonth: ByTier }>;
  supply?: Partial<{ safetyStockDaysPerLeadDay: number; minSafetyStockDays: number }>;
  fitoutWeeks?: number;
  /** Training weeks for first-time, some-experience and experienced partners. */
  trainingWeeks?: [number, number, number];
}

const t = (a: number, b: number, c: number): ByTier => ({ "1": a, "2": b, "3": c });

export const CATEGORY_PRESETS: Record<CategoryId, CategoryPreset> = {
  general: { id: "general", ticketRs: 350, label: "General store", noun: "retail store", blurb: "Everyday goods and kirana-style shops. The brand's original defaults." },
  qsr: {
    id: "qsr",
    ticketRs: 300,
    label: "Quick-service restaurant (QSR)",
    noun: "restaurant",
    blurb: "Fast food and cafes: costly kitchen fit-out, little stock, small shops, high sales per sq ft, perishables.",
    capex: { fitoutPerSqft: t(2800, 2200, 1700), stockPerSqft: t(400, 300, 250), franchiseFeeLakh: t(6, 5, 4), idealSize: t(400, 300, 250), minSize: t(250, 200, 150) },
    payback: { revenuePerSqftMonth: t(4500, 3200, 2200), grossMarginPct: 60, royaltyPct: 8, otherOpexPct: 12, staffCostLakhMonth: t(2.5, 1.8, 1.3) },
    supply: { safetyStockDaysPerLeadDay: 1, minSafetyStockDays: 2 },
    fitoutWeeks: 6,
    trainingWeeks: [4, 3, 2],
  },
  pharmacy: {
    id: "pharmacy",
    ticketRs: 450,
    label: "Pharmacy",
    noun: "pharmacy",
    blurb: "Medicines and wellness: heavy opening stock, thin margins, small ground-floor shops, licensing to complete.",
    capex: { fitoutPerSqft: t(1600, 1200, 900), stockPerSqft: t(3000, 2500, 2000), franchiseFeeLakh: t(3, 3, 2.5), idealSize: t(350, 280, 220), minSize: t(250, 200, 150) },
    payback: { revenuePerSqftMonth: t(2600, 2000, 1400), grossMarginPct: 20, royaltyPct: 3, otherOpexPct: 4, staffCostLakhMonth: t(1.2, 0.9, 0.7) },
    supply: { safetyStockDaysPerLeadDay: 2, minSafetyStockDays: 3 },
    fitoutWeeks: 4,
    trainingWeeks: [4, 3, 2],
  },
  apparel: {
    id: "apparel",
    ticketRs: 1800,
    label: "Apparel and footwear",
    noun: "apparel store",
    blurb: "Fashion retail: large shops, stylish fit-out, bulky seasonal stock, slower to build.",
    capex: { fitoutPerSqft: t(2200, 1700, 1300), stockPerSqft: t(2500, 1800, 1400), franchiseFeeLakh: t(5, 4, 3.5), idealSize: t(800, 650, 500), minSize: t(500, 400, 300) },
    payback: { revenuePerSqftMonth: t(1500, 1100, 800), grossMarginPct: 45, royaltyPct: 5, otherOpexPct: 4, staffCostLakhMonth: t(1.8, 1.3, 0.9) },
    supply: { safetyStockDaysPerLeadDay: 4, minSafetyStockDays: 6 },
    fitoutWeeks: 5,
    trainingWeeks: [3, 2, 1],
  },
  electronics: {
    id: "electronics",
    ticketRs: 9000,
    label: "Electronics and mobile",
    noun: "electronics store",
    blurb: "Phones and gadgets: costly stock, thin margins, mid-size shops, fast-moving range.",
    capex: { fitoutPerSqft: t(1700, 1300, 1000), stockPerSqft: t(4500, 3500, 2800), franchiseFeeLakh: t(4, 3.5, 3), idealSize: t(600, 500, 400), minSize: t(400, 320, 260) },
    payback: { revenuePerSqftMonth: t(3500, 2800, 2000), grossMarginPct: 14, royaltyPct: 3, otherOpexPct: 3, staffCostLakhMonth: t(1.2, 0.9, 0.7) },
    supply: { safetyStockDaysPerLeadDay: 3, minSafetyStockDays: 5 },
    fitoutWeeks: 4,
    trainingWeeks: [3, 2, 1],
  },
  eyewear: {
    id: "eyewear",
    ticketRs: 3500,
    label: "Eyewear and optical",
    noun: "optical store",
    blurb: "Eye tests and frames: premium fit-out, high margins, small shops, optometry basics to learn.",
    capex: { fitoutPerSqft: t(2400, 1900, 1500), stockPerSqft: t(2000, 1600, 1300), franchiseFeeLakh: t(5, 4.5, 4), idealSize: t(450, 400, 300), minSize: t(300, 250, 200) },
    payback: { revenuePerSqftMonth: t(2400, 1900, 1400), grossMarginPct: 60, royaltyPct: 5, otherOpexPct: 4, staffCostLakhMonth: t(1.4, 1, 0.8) },
    supply: { safetyStockDaysPerLeadDay: 4, minSafetyStockDays: 6 },
    fitoutWeeks: 4,
    trainingWeeks: [4, 3, 2],
  },
};

export const CATEGORY_IDS = Object.keys(CATEGORY_PRESETS) as CategoryId[];
export const DEFAULT_CATEGORY: CategoryId = "general";

export function presetOf(id: unknown): CategoryPreset {
  return typeof id === "string" && id in CATEGORY_PRESETS ? CATEGORY_PRESETS[id as CategoryId] : CATEGORY_PRESETS[DEFAULT_CATEGORY];
}

/** The brand's policy with the chosen store type's numbers laid over it. "General store" returns the defaults unchanged. */
export function policyFor(id: unknown): Policy {
  const preset = presetOf(id);
  const p = clonePolicy(DEFAULT_POLICY);
  if (preset.id === DEFAULT_CATEGORY) return p;
  Object.assign(p.capex, preset.capex ?? {});
  Object.assign(p.payback, preset.payback ?? {});
  Object.assign(p.supply, preset.supply ?? {});
  if (preset.fitoutWeeks !== undefined) p.timeline.fitoutWeeks = preset.fitoutWeeks;
  if (preset.trainingWeeks) p.training.tracks.forEach((track, i) => (track.weeks = preset.trainingWeeks![i] ?? track.weeks));
  p.brand = { ...p.brand, category: preset.noun };
  return p;
}

/** Customers a day a store would need to hit its estimated monthly sales (lakh rupees) at this type's typical bill. */
export function footfallPerDay(monthlySalesLakh: number, id: CategoryId | undefined): number {
  const ticket = presetOf(id).ticketRs;
  return Math.round((monthlySalesLakh * 1e5) / ticket / 30 / 10) * 10;
}
