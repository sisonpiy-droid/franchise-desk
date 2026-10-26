// Numbers behind the Rubric page, computed from the decisions the engine already made for the loaded file.
// Nothing here decides anything: it counts, averages and lays out the evidence so every outcome can be traced to a rule.
import { CODE_LABEL, type ReasonCode } from "./codes";
import type { Policy } from "./policy";
import type { Decision, RunResult, Status } from "./types";

export const STATUS_ORDER: Status[] = ["APPROVED", "CONDITIONAL", "WAITLISTED", "ON_HOLD", "DECLINED", "WITHDRAWN"];

/** The rule behind each reason, with this policy's own thresholds. */
export function ruleText(code: ReasonCode | null, p: Policy): string {
  const b = p.bars, c = p.capex;
  switch (code) {
    case null: return "Cleared every hard rule, scored at or above the bar and ranked inside the usable slots.";
    case "PIN_HAS_STORE":
    case "PIN_HAS_STORE_NO_ALT": return "One store per pin: our own store already sits on this pin.";
    case "PIN_TAKEN": return "One store per pin: a higher-ranked applicant (ready site, then score, then investment) took the pin.";
    case "SLOTS_FULL": return "Usable slots (the smaller of open slots and free pins) are all taken by higher-ranked applicants.";
    case "BELOW_BAR": return `Score under the approval bar: ${b.approval + b.priorityAdjust.High} in High, ${b.approval} in Medium, ${b.approval + b.priorityAdjust.Low} in Low priority territories (decline below ${b.decline}).`;
    case "INVEST_LOW": return `Funds below ${c.declineBelowPct}% of the estimated cost.`;
    case "FUNDING_GAP": return `Funds between ${c.declineBelowPct}% and 100% of the estimated cost: proof of funds or a co-investor is requested.`;
    case "OUT_OF_TERRITORY": return "The pin is not covered by any territory with open slots.";
    case "PIN_MISSING":
    case "PIN_INVALID":
    case "DATA_MISSING":
    case "DATA_INVALID": return "A required detail is blank or unreadable: held with the exact detail requested.";
    case "CITY_PIN_MISMATCH":
    case "UNIT_ERROR":
    case "NOTE_CONFLICT":
    case "EXPERIENCE_CONFLICT":
    case "SPACE_CONTRADICTION":
    case "SPACE_SIZE_MISSING":
    case "FLOOR_UNKNOWN":
    case "SPACE_SMALL": return "Two details contradict each other or a space detail is missing: held until clarified.";
    case "CLAIM_UNVERIFIED": return "New facts given in the desk are recorded but not yet verified.";
    case "TARGET_INFEASIBLE": return "The launch target is earlier than the weeks the opening plan needs.";
    case "CONTESTED": return "Outranks an approved partner: a person must confirm the swap.";
    case "LOAN_DEPENDENT":
    case "FUZZY_IDENTITY":
    case "SAME_PROPERTY_CLAIM":
    case "SLOT_SQUATTING":
    case "CAPACITY_OUTLIER":
    case "WEAK_TITLE":
    case "CONFLICT_OF_INTEREST":
    case "COMPLIANCE_CUE": return "Integrity check: routed to a document check, never a decline on its own.";
    default: return CODE_LABEL[code] ?? "";
  }
}

export interface ReasonRow {
  status: Status;
  code: ReasonCode | null;
  label: string;
  rule: string;
  count: number;
  pct: number;
  avgScore: number | null;
  ids: string[];
}

/** Every (outcome, primary reason) pair with how many applicants it explains. */
export function reasonLedger(result: RunResult, p: Policy): ReasonRow[] {
  const total = result.decisions.length || 1;
  const map = new Map<string, Decision[]>();
  for (const d of result.decisions) {
    const code = (d.status === "APPROVED" ? null : d.codes[0] ?? null) as ReasonCode | null;
    const k = `${d.status}|${code ?? ""}`;
    map.set(k, [...(map.get(k) ?? []), d]);
  }
  const rows: ReasonRow[] = [];
  for (const [k, ds] of map) {
    const [status, code] = k.split("|") as [Status, string];
    const c = (code || null) as ReasonCode | null;
    const scores = ds.map((d) => d.score?.total).filter((x): x is number => typeof x === "number");
    rows.push({
      status,
      code: c,
      label: c ? CODE_LABEL[c] : status === "APPROVED" ? "Cleared every rule" : status === "CONDITIONAL" ? "Slot reserved, site still to find" : "No specific reason recorded",
      rule: c || status === "APPROVED" ? ruleText(c, p) : status === "CONDITIONAL" ? `Strong score but no qualifying site yet: a slot is reserved for ${p.windows.conditionalDays} days while one is found.` : ruleText(c, p),
      count: ds.length,
      pct: Math.round((ds.length / total) * 1000) / 10,
      avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      ids: ds.map((d) => d.id),
    });
  }
  return rows.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.count - a.count || (a.label < b.label ? -1 : 1));
}

export type Group = "Moving forward" | "Waitlisted" | "On hold" | "Declined";
export const GROUPS: Group[] = ["Moving forward", "Waitlisted", "On hold", "Declined"];
const groupOf = (s: Status): Group | null => (s === "APPROVED" || s === "CONDITIONAL" ? "Moving forward" : s === "WAITLISTED" ? "Waitlisted" : s === "ON_HOLD" ? "On hold" : s === "DECLINED" ? "Declined" : null);

export const AREAS = [
  { key: "capital", label: "Funds vs estimate" },
  { key: "experience", label: "Experience" },
  { key: "space", label: "Space readiness" },
  { key: "timeline", label: "Timing" },
  { key: "territory", label: "Location" },
] as const;

export interface GroupAverage {
  group: Group;
  n: number;
  total: number | null;
  areas: Record<string, number | null>;
  fundsPct: number | null;
}

/** Average points per scored area for each outcome group: shows which areas separate selected from held. */
export function groupAverages(result: RunResult): GroupAverage[] {
  return GROUPS.map((g) => {
    const ds = result.decisions.filter((d) => groupOf(d.status) === g);
    const scored = ds.filter((d) => d.score);
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
    const areas: Record<string, number | null> = {};
    for (const a of AREAS) areas[a.key] = avg(scored.map((d) => d.score!.components.find((c) => c.key === a.key)?.value ?? 0));
    const ratios = ds.map((d) => d.capex?.ratio).filter((x): x is number => typeof x === "number").map((x) => x * 100);
    return { group: g, n: ds.length, total: avg(scored.map((d) => d.score!.total)), areas, fundsPct: ratios.length ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length) : null };
  });
}

export interface Bin { lo: number; hi: number; byStatus: Record<Status, number>; total: number }

/** Score histogram, 10-point bins, split by outcome. Applicants with no score yet are counted separately. */
export function histogram(result: RunResult, size = 10): { bins: Bin[]; unscored: number } {
  const bins: Bin[] = [];
  for (let lo = 0; lo < 100; lo += size) bins.push({ lo, hi: lo + size - 1 + (lo + size >= 100 ? 1 : 0), byStatus: { APPROVED: 0, CONDITIONAL: 0, WAITLISTED: 0, ON_HOLD: 0, DECLINED: 0, WITHDRAWN: 0 }, total: 0 });
  let unscored = 0;
  for (const d of result.decisions) {
    if (!d.score) { unscored++; continue; }
    const i = Math.min(bins.length - 1, Math.floor(d.score.total / size));
    bins[i].byStatus[d.status]++;
    bins[i].total++;
  }
  return { bins, unscored };
}

export interface ScoreRow {
  key: string;
  id: string;
  name: string;
  territory: string | null;
  status: Status;
  areas: Record<string, number | null>;
  total: number | null;
  bar: number | null;
  vsBar: number | null;
  fundsPct: number | null;
  decidedBy: string;
  notes: { label: string; value: number; max: number; note: string }[];
}

/** One row per applicant with every scored point, the bar it faced, and the rule that decided the outcome. */
export function scorecard(result: RunResult): ScoreRow[] {
  return result.decisions.map((d) => {
    const areas: Record<string, number | null> = {};
    for (const a of AREAS) areas[a.key] = d.score ? d.score.components.find((c) => c.key === a.key)?.value ?? null : null;
    const code = (d.status === "APPROVED" ? null : d.codes[0] ?? null) as ReasonCode | null;
    return {
      key: d.key,
      id: d.id,
      name: d.name,
      territory: d.territoryId,
      status: d.status,
      areas,
      total: d.score?.total ?? null,
      bar: d.bar,
      vsBar: d.score && d.bar !== null ? d.score.total - d.bar : null,
      fundsPct: d.capex?.ratio != null ? Math.round(d.capex.ratio * 100) : null,
      decidedBy: code ? CODE_LABEL[code] : d.status === "APPROVED" ? "Cleared every rule" : d.status === "CONDITIONAL" ? "Slot reserved, site still to find" : "–",
      notes: d.score ? d.score.components.map((c) => ({ label: c.label, value: c.value, max: c.max, note: c.note })) : [],
    };
  });
}
