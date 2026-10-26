// Store categories for the assumed-orders heatmap. Every number is an illustrative planning assumption, not data:
// the file has no order history. A category changes the order volumes, the size of a typical store, how fast a new store
// ramps up, how much the shop's position matters, and what the model is told drives demand around a pin code.
// It does not change any decision (approve, hold, decline).
import type { Tier } from "./types";

export type CategoryId = "qsr" | "general" | "pharmacy" | "apparel" | "electronics" | "eyewear";

export interface Category {
  id: CategoryId;
  label: string;
  blurb: string;
  /** Orders (bills) a month for a mature store of typical size, by city tier. */
  ordersPerMonth: Record<Tier, number>;
  /** Typical shop size in sq ft, by city tier. Volume scales with size against this. */
  typicalSize: Record<Tier, number>;
  /** A new store starts at this share of its mature volume... */
  startShare: number;
  /** ...and reaches full volume after this many months. */
  rampMonths: number;
  /** How the shop's position changes footfall. */
  floor: { Ground: number; Mall: number; Upper: number; Unknown: number };
  /** What drives demand for this kind of store, in the words the model is given. */
  drivers: string;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  qsr: {
    id: "qsr",
    label: "Quick-service restaurant (QSR)",
    blurb: "Fast food and cafes: many small orders, strong at food courts and busy corners, quick to ramp.",
    ordersPerMonth: { 1: 3000, 2: 2200, 3: 1400 },
    typicalSize: { 1: 400, 2: 300, 3: 250 },
    startShare: 0.5,
    rampMonths: 4,
    floor: { Ground: 1, Mall: 1.3, Upper: 0.5, Unknown: 0.8 },
    drivers: "walk-in footfall at lunch and evening, offices, colleges and schools, transit stops, food courts, nightlife and busy street corners",
  },
  general: {
    id: "general",
    label: "General store",
    blurb: "Everyday goods and kirana-style shops: steady neighbourhood demand.",
    ordersPerMonth: { 1: 900, 2: 650, 3: 420 },
    typicalSize: { 1: 600, 2: 450, 3: 350 },
    startShare: 0.35,
    rampMonths: 9,
    floor: { Ground: 1, Mall: 1.15, Upper: 0.6, Unknown: 0.85 },
    drivers: "residential density, nearby markets and bus stops, household incomes, and how many similar shops already serve the area",
  },
  pharmacy: {
    id: "pharmacy",
    label: "Pharmacy",
    blurb: "Health and wellness: driven by homes, clinics and hospitals, loyal repeat customers.",
    ordersPerMonth: { 1: 700, 2: 520, 3: 360 },
    typicalSize: { 1: 350, 2: 280, 3: 220 },
    startShare: 0.45,
    rampMonths: 5,
    floor: { Ground: 1, Mall: 0.9, Upper: 0.5, Unknown: 0.8 },
    drivers: "residential density, older residents, nearby clinics and hospitals, and easy ground-level access",
  },
  apparel: {
    id: "apparel",
    label: "Apparel and footwear",
    blurb: "Fashion retail: destination shopping, best in malls and high streets, slower to build.",
    ordersPerMonth: { 1: 600, 2: 420, 3: 280 },
    typicalSize: { 1: 800, 2: 650, 3: 500 },
    startShare: 0.3,
    rampMonths: 10,
    floor: { Ground: 1, Mall: 1.25, Upper: 0.7, Unknown: 0.85 },
    drivers: "high-street and mall shopping districts, college and office crowds, household incomes, festival and wedding shopping",
  },
  electronics: {
    id: "electronics",
    label: "Electronics and mobile",
    blurb: "Phones and gadgets: fewer, larger purchases, strong near electronics markets.",
    ordersPerMonth: { 1: 500, 2: 380, 3: 260 },
    typicalSize: { 1: 600, 2: 500, 3: 400 },
    startShare: 0.35,
    rampMonths: 8,
    floor: { Ground: 1, Mall: 1.2, Upper: 0.7, Unknown: 0.85 },
    drivers: "electronics markets and clusters, college and office crowds, household incomes, and nearby service centres",
  },
  eyewear: {
    id: "eyewear",
    label: "Eyewear and optical",
    blurb: "Eye tests and frames: appointment-led, builds slowly, favours busy shopping areas.",
    ordersPerMonth: { 1: 350, 2: 260, 3: 180 },
    typicalSize: { 1: 450, 2: 400, 3: 300 },
    startShare: 0.3,
    rampMonths: 10,
    floor: { Ground: 1, Mall: 1.1, Upper: 0.65, Unknown: 0.85 },
    drivers: "shopping districts and malls, office and college crowds, household incomes, nearby clinics and eye hospitals",
  },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];
export const DEFAULT_CATEGORY: CategoryId = "general";

export function categoryOf(id: unknown): Category {
  return typeof id === "string" && id in CATEGORIES ? CATEGORIES[id as CategoryId] : CATEGORIES[DEFAULT_CATEGORY];
}
