"use client";
// One page: how every decision is calculated. Every number is read live from the Policy, so editing a value in the
// Policy panel changes this page too. Figures for cost and payback are illustrative assumptions, as the Policy says.
import type { Policy } from "@/lib/engine/policy";

function Table({ head, rows, widths }: { head: string[]; rows: (string | React.ReactNode)[][]; widths?: string[] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[520px] text-left text-[13px]">
        <thead className="bg-surface-2 text-[11.5px] uppercase tracking-wider text-muted">
          <tr>{head.map((h, i) => <th key={h} className="px-3 py-2 font-semibold" style={widths?.[i] ? { width: widths[i] } : undefined}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line align-top">
              {r.map((c, j) => <td key={j} className={`px-3 py-2 ${j === 0 ? "font-semibold text-ink" : "text-ink-2"}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const H = ({ n, children }: { n: string; children: React.ReactNode }) => (
  <h3 className="mt-6 flex items-center gap-2 text-[15px] font-semibold">
    <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-[12px] text-neon">{n}</span>
    {children}
  </h3>
);

export function RubricPanel({ policy: p }: { policy: Policy }) {
  const s = p.score, c = p.capex, b = p.bars, t = p.timeline;
  const barHigh = b.approval + b.priorityAdjust.High, barLow = b.approval + b.priorityAdjust.Low;
  const total = s.capital.max + s.experience.max + s.space.max + s.timeline.max + s.territory.max;
  return (
    <div className="text-[13.5px] leading-relaxed text-ink-2" data-testid="rubric">
      <p className="text-ink">
        Every application goes through four steps: <b>hard rules</b> (pass or fail), a <b>score out of {total}</b>, a <b>bar</b> to clear, and a <b>ranking</b> when applicants compete.
        Names, language and notes never change the score. The AI never decides anything.
      </p>

      <H n="0">The five outcomes</H>
      <Table
        head={["Outcome", "What it means", "When"]}
        widths={["22%", "30%", "48%"]}
        rows={[
          ["Approved", "Moving forward, holds a slot", `Passes every hard rule, score at or above the bar, and ranks inside the usable slots.`],
          ["Conditional", `Slot reserved for ${p.windows.conditionalDays} days`, "Strong score, but still needs a qualifying site or a document check. Becomes Approved once verified."],
          ["Waitlisted", "In the queue", "Eligible, but another applicant outranks them for the pin or the slot. Moves up automatically if a slot opens."],
          ["On hold", "We need information", `A detail is missing or contradicts another, or funds are short. Never uses a slot. Closes after ${p.windows.holdCloseDays} days with no reply.`],
          ["Declined", "Not proceeding now", "Pin outside every open territory, funds far below the estimate, score under the decline bar, or no free pin in the area."],
        ]}
      />

      <H n="1">Hard rules: pass or fail, before any score</H>
      <Table
        head={["Rule", "What is checked", "If it fails"]}
        widths={["24%", "46%", "30%"]}
        rows={[
          ["Data is readable", "Pin, investment, space and size are present and agree with each other.", "On hold, with the exact detail needed"],
          ["Pin is in an open territory", "The pin code is covered by a territory that has open slots.", "Declined (redirect offered if one exists)"],
          ["One store per pin", "No pin repeats across our existing stores and the new stores.", "On hold or Waitlisted"],
          ["Slots", "Usable capacity = the smaller of open slots and free pins in the territory.", "Waitlisted"],
          ["Funds", `Funds against the estimated cost (see step 5). Below ${c.declineBelowPct}% is too low; ${c.declineBelowPct}% to 100% is a gap.`, `Declined below ${c.declineBelowPct}%, On hold between`],
          ["Spacing", `Two new stores closer than ${p.spacing.km} km to each other.`, "Only if slots remain"],
          ["City store cap", `Guide per city: Tier 1 ${p.density.capPerCityByTier["1"]}, Tier 2 ${p.density.capPerCityByTier["2"]}, Tier 3 ${p.density.capPerCityByTier["3"]} stores.`, "Flagged for a person"],
        ]}
      />

      <H n="2">The score: {total} points, five areas</H>
      <Table
        head={["Area", "Points", "How points are earned"]}
        widths={["22%", "10%", "68%"]}
        rows={[
          ["Funds vs estimate", String(s.capital.max), `Full ${s.capital.max} when funds reach ${Math.round(s.capital.fullAtRatio * 100)}% of the estimate; ${s.capital.atRatioOne} at exactly 100%; scaled down between ${c.declineBelowPct}% and 100%; none below.`],
          ["Experience", String(s.experience.max), `Up to ${s.experience.yearsPoints} for years of retail experience (capped at ${s.experience.yearsCap} years), plus up to ${s.experience.relevancePoints} if the business is directly relevant (half if partly).`],
          ["Space readiness", String(s.space.max), `Tenure (Owned ${s.space.tenure.Owned}, Rented ${s.space.tenure.Rented}) + size up to ${s.space.sizePoints} (full at the ideal size, half at the minimum) + floor (Ground ${s.space.floor.retail.Ground}, Mall ${s.space.floor.retail.Mall}, Upper ${s.space.floor.retail.Upper}). No site yet earns ${s.space.noSiteCredit}.`],
          ["Timing", String(s.timeline.max), `Full ${s.timeline.max} if their target date allows the weeks the plan needs; scaled down otherwise (minimum ${s.timeline.minPoints}). No target given earns ${s.timeline.unknownPoints}.`],
          ["Location", String(s.territory.max), `Territory priority (High ${s.territory.priorityPoints.High}, Medium ${s.territory.priorityPoints.Medium}, Low ${s.territory.priorityPoints.Low}) + up to ${s.territory.cannibalisationPoints} for distance from our existing stores (less overlap, more points).`],
        ]}
      />
      <p className="mt-2 text-[12.5px] text-muted">Missing information is never scored as zero by guesswork: an unknown value is put on hold and asked for.</p>

      <H n="3">The bars: which score is enough</H>
      <Table
        head={["Territory priority", "Approval bar", "Below it"]}
        rows={[
          ["High", String(barHigh), "Waitlisted"],
          ["Medium", String(b.approval), "Waitlisted"],
          ["Low", String(barLow), "Waitlisted"],
          ["Any priority", `Under ${b.decline}`, "Declined"],
        ]}
      />
      <p className="mt-2 text-[12.5px] text-muted">High-priority territories accept a lower score ({b.priorityAdjust.High} points); low-priority ones ask for more (+{b.priorityAdjust.Low}).</p>

      <H n="4">When applicants compete: who gets the slot</H>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Applicants with a ready site go first.</li>
        <li>Then the higher score.</li>
        <li>Then the larger investment, then the lower application ID, so the result is always the same for the same file.</li>
        <li>Leftover slots are held for {p.windows.conditionalDays} days for strong applicants still finding a site.</li>
        <li>An approved partner is never replaced automatically. If someone new outranks them, the desk recommends a swap and a person must confirm it.</li>
      </ol>

      <H n="5">The money estimate</H>
      <p className="mt-2">
        Estimated cost = (fit-out + opening stock per sq ft) × shop size + franchise fee + rent deposit ({c.depositMonths} months, rented space only) + runway ({c.runwayMonths} months, rented space only) + {c.bufferPct}% buffer.
      </p>
      <Table
        head={["City tier", "Fit-out ₹/sq ft", "Stock ₹/sq ft", "Fee ₹ lakh", "Ideal size", "Minimum size"]}
        rows={(["1", "2", "3"] as const).map((k) => [`Tier ${k}`, String(c.fitoutPerSqft[k]), String(c.stockPerSqft[k]), String(c.franchiseFeeLakh[k]), `${c.idealSize[k]} sq ft`, `${c.minSize[k]} sq ft`])}
      />
      <p className="mt-2 text-[12.5px] text-muted">These are illustrative planning assumptions, editable in Policy. Payback longer than {p.payback.flagAboveMonths} months is flagged.</p>

      <H n="6">The opening plan: how long it takes</H>
      <Table
        head={["Stage", "Weeks"]}
        rows={[
          ["KYC and franchise agreement", String(t.kycAgreementWeeks)],
          ["Site (owned / rented / still to find)", `${t.siteWeeks.Owned} / ${t.siteWeeks.Rented} / ${t.siteWeeks.None}`],
          ["Fit-out (extra for mall / upper floor)", `${t.fitoutWeeks} (+${t.fitoutExtra.Mall} / +${t.fitoutExtra.Upper})`],
          ["First stock and POS", String(t.stockPosWeeks)],
          ["Tier 3 logistics, if the city is Tier 3", `+${t.tier3LogisticsWeeks}`],
        ]}
      />
      <p className="mt-2 text-[12.5px] text-muted">Training runs in parallel with fit-out, in the applicant's language. These are suggested durations, not contractual deadlines.</p>

      <p className="mt-6 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12.5px]">
        Everything on this page is read live from the <b>Policy</b> panel. Change a number there and this page, and every decision, updates.
      </p>
    </div>
  );
}
