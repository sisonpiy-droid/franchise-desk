// Strategy views built only from what the engine already decided: no new data, no hidden weights.
// 1. Where should we expand?  Territories sorted by a written rule, each with the reason in numbers.
// 2. Who should we invest our time in?  Partners grouped by what the engine can prove, ordered by payback then score.
import { CODE_LABEL } from "./codes";
import { counterfactuals } from "./counterfactual";
import type { Step } from "./session";
import type { Decision, Priority, TerritorySummary } from "./types";

// ---- thresholds: plain constants so a reviewer can read and change them ----
/** A territory is held back when at least this share of its partners and waiting applicants sit in a high-overlap catchment. */
export const HIGH_OVERLAP_SHARE = 0.5;
/** How many held applicants get a "one fix away" what-if run (each one re-runs the engine, so the list is capped). */
export const FIX_LOOKUP_LIMIT = 12;
/** On files over 250 applications each re-run costs more, so fewer held applicants get one. */
export const FIX_LOOKUP_LIMIT_LARGE = 4;

export type TerritoryVerdict = "expand" | "recruit" | "hold" | "blocked" | "full";

export const VERDICT_LABEL: Record<TerritoryVerdict, string> = {
  expand: "Expand now",
  recruit: "Recruit partners",
  hold: "Hold: overlap review",
  blocked: "Blocked",
  full: "Full",
};

/** The rule behind each verdict, shown to the operator. First rule that matches wins. */
export const VERDICT_RULE: Record<TerritoryVerdict, string> = {
  blocked: "Slots are open but no free pin code is left, so no store can be placed.",
  full: "Every usable slot is already taken by an approved or conditional partner.",
  hold: `At least ${HIGH_OVERLAP_SHARE * 100}% of the people in this territory would sit inside a high-overlap catchment of an existing store.`,
  recruit: "Usable slots are open but nobody who could fill them has applied.",
  expand: "Usable slots are open and applicants who could fill them are waiting.",
};

const ORDER: TerritoryVerdict[] = ["expand", "recruit", "hold", "blocked", "full"];
const PRIO: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export interface TerritoryRow {
  key: string;
  id: string;
  city: string | null;
  tier: number | null;
  priority: Priority | null;
  slots: number;
  usable: number;
  taken: number;
  remaining: number;
  freePins: number;
  applicants: number;
  waiting: number;
  medianScore: number | null;
  highOverlap: number;
  verdict: TerritoryVerdict;
  reason: string;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
};

function verdictOf(t: TerritorySummary, remaining: number, waiting: number, shareHigh: number): TerritoryVerdict {
  if ((t.slots ?? 0) > 0 && t.effectiveCapacity === 0) return "blocked";
  if (remaining <= 0) return "full";
  if (shareHigh >= HIGH_OVERLAP_SHARE) return "hold";
  if (waiting === 0) return "recruit";
  return "expand";
}

/** Every territory with a verdict, best place to act first. */
export function territoryRanking(step: Step): TerritoryRow[] {
  const { result } = step;
  const rows = result.territories.map((t): TerritoryRow => {
    const here = result.decisions.filter((d) => d.territoryKey === t.key && d.status !== "WITHDRAWN");
    const taken = t.approved.length + t.conditional.length;
    const remaining = Math.max(0, t.effectiveCapacity - taken);
    const waiting = here.filter((d) => d.status === "WAITLISTED" || d.status === "ON_HOLD").length;
    const active = here.filter((d) => d.status !== "DECLINED");
    const highOverlap = active.filter((d) => d.nearest?.risk === "high").length;
    const shareHigh = active.length ? highOverlap / active.length : 0;
    const verdict = verdictOf(t, remaining, waiting, shareHigh);
    const scores = here.map((d) => d.score?.total).filter((x): x is number => typeof x === "number");
    const n = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
    const reason =
      verdict === "blocked"
        ? `${n(t.slots ?? 0, "slot")} open, but ${t.pins.length === 1 ? "its only pin code already has" : `all ${t.pins.length} pin codes already have`} one of our stores.`
        : verdict === "full"
          ? `${t.effectiveCapacity === 1 ? "The only usable slot is" : `All ${t.effectiveCapacity} usable slots are`} taken (${taken} approved or conditional).`
          : verdict === "hold"
            ? `${highOverlap} of ${active.length} in this territory sit in a high-overlap catchment of an existing store. Check cannibalisation before adding more.`
            : verdict === "recruit"
              ? `${n(remaining, "usable slot")} open and no waiting applicant. ${n(t.freePins.length, "free pin code")} available.`
              : `${n(remaining, "usable slot")} open and ${n(waiting, "applicant")} waiting (waitlisted or held for information).`;
    return {
      key: t.key,
      id: t.id,
      city: t.city,
      tier: t.tier,
      priority: t.priority,
      slots: t.slots,
      usable: t.effectiveCapacity,
      taken,
      remaining,
      freePins: t.freePins.length,
      applicants: here.length,
      waiting,
      medianScore: median(scores),
      highOverlap,
      verdict,
      reason,
    };
  });
  return rows.sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict) || (PRIO[a.priority ?? "Low"] ?? 3) - (PRIO[b.priority ?? "Low"] ?? 3) || (a.tier ?? 9) - (b.tier ?? 9) || b.remaining - a.remaining || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------------------------------------------------

export type ShortlistGroup = "invest" | "fix" | "walk";
export const GROUP_LABEL: Record<ShortlistGroup, string> = { invest: "Invest your time now", fix: "One fix away", walk: "Walk away" };
export const GROUP_RULE: Record<ShortlistGroup, string> = {
  invest: "Approved or conditional, so the hard rules are met. Ordered by shortest payback, then highest score.",
  fix: "Held, waitlisted or conditional without a site, where one small change tested by the engine moves them forward.",
  walk: "Declined: a hard rule is not met. Re-open only if their situation changes.",
};

export interface PartnerRow {
  key: string;
  id: string;
  name: string;
  group: ShortlistGroup;
  status: Decision["status"];
  territoryId: string | null;
  score: number | null;
  /** Estimated months to pay back the investment (illustrative; null when sales never cover costs). */
  paybackMonths: number | null;
  required: number | null;
  invest: number | null;
  /** Declared funds minus the estimated need, in ₹ lakh; negative means a gap. */
  fundsGap: number | null;
  risk: string | null;
  weeksToOpen: number | null;
  readyBy: string | null;
  action: string;
  fix: string | null;
  fixTo: Decision["status"] | null;
}

const riskOf = (d: Decision): string | null => {
  const f = d.flags[0];
  if (f) return `${CODE_LABEL[f.code] ?? f.code}`;
  if (d.stability?.label === "borderline") return "Borderline: a small change could flip the decision";
  return null;
};

function base(d: Decision, group: ShortlistGroup): PartnerRow {
  const cx = d.capex;
  const invest = cx?.invest ?? null;
  return {
    key: d.key,
    id: d.id,
    name: d.name,
    group,
    status: d.status,
    territoryId: d.territoryId,
    score: d.score?.total ?? null,
    paybackMonths: d.plan?.payback.months ?? null,
    required: cx ? Math.round(cx.required * 10) / 10 : null,
    invest,
    fundsGap: cx && invest !== null ? Math.round((invest - cx.required) * 10) / 10 : null,
    risk: riskOf(d),
    weeksToOpen: d.plan?.totalWeeks ?? null,
    readyBy: d.plan?.readyDate ?? null,
    action: d.nextStep,
    fix: null,
    fixTo: null,
  };
}

const byPayback = (a: PartnerRow, b: PartnerRow) => (a.paybackMonths ?? 1e9) - (b.paybackMonths ?? 1e9) || (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id);

/** Partners sorted into three groups; the fix lookup is limited to the strongest held applicants to keep the page fast. */
export function partnerShortlist(step: Step, today: string): Record<ShortlistGroup, PartnerRow[]> {
  const ds = step.result.decisions;
  const invest = ds.filter((d) => (d.status === "APPROVED" || d.status === "CONDITIONAL") && d.allocatedPin).map((d) => base(d, "invest")).sort(byPayback);
  const walk = ds.filter((d) => d.status === "DECLINED").map((d) => ({ ...base(d, "walk"), action: d.why })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id));

  const open = ds
    .filter((d) => d.status === "ON_HOLD" || d.status === "WAITLISTED" || (d.status === "CONDITIONAL" && !d.allocatedPin))
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0) || a.id.localeCompare(b.id))
    .slice(0, step.dataset.applications.length > 250 ? FIX_LOOKUP_LIMIT_LARGE : FIX_LOOKUP_LIMIT);
  const fix: PartnerRow[] = [];
  for (const d of open) {
    const best = counterfactuals(step, d.key, today).find((w) => w.improves);
    if (best) fix.push({ ...base(d, "fix"), fix: best.change, fixTo: best.to });
  }
  fix.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id));
  return { invest, fix, walk };
}
