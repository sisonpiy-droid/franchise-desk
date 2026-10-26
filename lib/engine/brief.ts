// Executive brief: a one-page "what changed and what needs a decision" for a manager.
// Built only from the run and the control tower; money figures keep their "illustrative" label.
import { CODE_LABEL } from "./codes";
import type { Policy } from "./policy";
import { controlTower } from "./tower";
import type { Dataset, RunResult } from "./types";

export interface BriefSection {
  title: string;
  items: { text: string; key?: string }[]; // key opens that decision
}

export interface Brief {
  date: string;
  fileName: string;
  headline: string;
  numbers: { label: string; value: string }[];
  sections: BriefSection[];
}

const lakh = (n: number) => (n >= 100 ? `₹${(n / 100).toFixed(2).replace(/\.?0+$/, "")} crore` : `₹${Math.round(n * 10) / 10} lakh`);
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function buildBrief(result: RunResult, dataset: Dataset, policy: Policy, today: string): Brief {
  const tower = controlTower(result, policy, today);
  const ds = result.decisions;
  const count = (s: string) => ds.filter((d) => d.status === s).length;
  const approved = count("APPROVED");
  const conditional = count("CONDITIONAL");
  const moving = approved + conditional;
  const usable = result.territories.reduce((n, t) => n + t.effectiveCapacity, 0);
  const used = result.territories.reduce((n, t) => n + t.approved.length + t.conditional.length, 0);
  const headline = `${moving} of ${plural(ds.length, "application")} are moving forward (${approved} approved, ${conditional} conditional), and ${used} of ${plural(usable, "usable slot")} are held.`;

  const sections: BriefSection[] = [];

  sections.push({
    title: "Decisions needed this week",
    items: tower.calls.slice(0, 6).map((c) => ({ key: c.key, text: `${c.id}: ${c.action} (${c.owner}${c.daysLeft ? `, ${c.daysLeft} days left` : ""}, ${lakh(c.valueLakh)} at stake)` })),
  });

  // what the holds are waiting for, most common first
  const reasons = new Map<string, number>();
  for (const d of ds) if (d.status === "ON_HOLD" && d.codes[0]) reasons.set(CODE_LABEL[d.codes[0]], (reasons.get(CODE_LABEL[d.codes[0]]) ?? 0) + 1);
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  sections.push({ title: `What the ${plural(count("ON_HOLD"), "hold")} are waiting for`, items: top.map(([label, n]) => ({ text: `${n} × ${label.toLowerCase()}` })) });

  const pending = ds.filter((d) => d.status === "CONDITIONAL");
  const pendingCapital = pending.reduce((n, d) => n + (d.capex?.required ?? 0), 0);
  sections.push({
    title: "Money and timing",
    items: [
      { text: `${lakh(tower.capacity.committedLakh)} of partner capital is committed (illustrative estimates), of which ${lakh(pendingCapital)} is still conditional on a check or a site.` },
      ...(tower.openings.length ? [{ text: `Expected openings: ${tower.openings.slice(0, 3).map((o) => `${o.expected} in ${o.month}`).join(", ")} (risk-adjusted).` }] : []),
      ...(tower.delay.lostPerMonthLakh !== null && tower.delay.openSlots > 0 ? [{ text: `${plural(tower.delay.openSlots, "open slot")} cost about ${lakh(tower.delay.lostPerMonthLakh)} a month in forgone profit (illustrative).` }] : []),
      ...(tower.delay.blockedSlots > 0 ? [{ text: `${plural(tower.delay.blockedSlots, "wanted slot")} cannot be filled because no pin is free; sourcing will not fix this.` }] : []),
    ],
  });

  sections.push({
    title: "Territories needing attention",
    items: [
      ...tower.gap.slice(0, 5).map((g) => ({ text: `${g.territory}: ${g.action}` })),
      ...(tower.pipeline.totalSource > 0 ? [{ text: `About ${plural(tower.pipeline.totalSource, "more application")} are needed across territories (placement rate ${Math.round(tower.pipeline.rate * 100)}%${tower.pipeline.smallSample ? ", small file" : ""}).` }] : []),
    ],
  });

  const has = (code: string) => ds.filter((d) => (d.status === "APPROVED" || d.status === "CONDITIONAL" || d.status === "ON_HOLD") && d.codes.includes(code as never)).length;
  const risks = [
    [has("CLAIM_UNVERIFIED"), "unverified claims waiting for proof"],
    [has("COMPLIANCE_CUE"), "compliance checks open"],
    [has("SAME_PROPERTY_CLAIM") + has("FUZZY_IDENTITY") + has("SLOT_SQUATTING"), "same-property, identity or duplicate-reservation questions to settle"],
    [has("NOTE_CONFLICT"), "applicants whose notes contradict the form"],
  ] as [number, string][];
  sections.push({ title: "Risks to watch", items: risks.filter(([n]) => n > 0).map(([n, t]) => ({ text: `${n} ${t}` })) });

  return {
    date: today,
    fileName: dataset.source === "sample" ? "Sample data" : dataset.fileName,
    headline,
    numbers: [
      { label: "Moving forward", value: `${moving} of ${ds.length}` },
      { label: "Slots filled", value: `${used} / ${usable}` },
      { label: "Capital committed", value: lakh(tower.capacity.committedLakh) },
      { label: "On hold", value: `${count("ON_HOLD")}` },
    ],
    sections: sections.filter((s) => s.items.length > 0),
  };
}

/** The same brief as plain text, for pasting into an email or a chat. */
export function briefText(b: Brief): string {
  return [`Expansion brief, ${b.date} (${b.fileName})`, "", b.headline, "", b.numbers.map((n) => `${n.label}: ${n.value}`).join("  |  "), "", ...b.sections.flatMap((s) => [s.title.toUpperCase(), ...s.items.map((i) => `- ${i.text}`), ""]), "Money figures are illustrative planning estimates."].join("\n");
}
