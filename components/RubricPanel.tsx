"use client";
// The Rubric: one place that says how every decision is calculated, and, for the loaded file, shows the numbers that
// explain why each applicant was selected, held, waitlisted or declined. Every threshold is read live from the Policy.
import { Fragment, useMemo, useState } from "react";
import type { Policy } from "@/lib/engine/policy";
import { VERDICT_SHORT } from "@/lib/engine/plain";
import { AREAS, GROUPS, groupAverages, histogram, reasonLedger, scorecard, STATUS_ORDER, type ScoreRow } from "@/lib/engine/rubric";
import type { RunResult, Status } from "@/lib/engine/types";
import { STATUS_VAR } from "./icons";

const MAXES: Record<string, number> = { capital: 25, experience: 20, space: 25, timeline: 10, territory: 20 };
const num = (v: number | null, d = 1) => (v === null ? "–" : String(Math.round(v * 10 ** d) / 10 ** d));

function Table({ head, rows, widths, small }: { head: string[]; rows: React.ReactNode[][]; widths?: string[]; small?: boolean }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-line">
      <table className={`w-full min-w-[520px] text-left ${small ? "text-[12.5px]" : "text-[13px]"}`}>
        <thead className="bg-surface-2 text-[11.5px] uppercase tracking-wider text-muted">
          <tr>{head.map((h, i) => <th key={h + i} className="px-3 py-2 font-semibold" style={widths?.[i] ? { width: widths[i] } : undefined}>{h}</th>)}</tr>
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

const H = ({ id, n, children }: { id: string; n: string; children: React.ReactNode }) => (
  <h3 id={id} className="mt-9 flex scroll-mt-16 items-center gap-2 text-[16px] font-semibold">
    <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-[12px] text-neon">{n}</span>
    {children}
  </h3>
);
const Read = ({ children }: { children: React.ReactNode }) => <p className="mt-1.5 text-[12.5px] italic text-muted">How to read it: {children}</p>;
const Dot = ({ s }: { s: Status }) => <i className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: STATUS_VAR[s] }} aria-hidden />;
const mono = "font-mono text-[12.5px] text-ink";

function heat(v: number | null, max: number) {
  if (v === null) return undefined;
  const f = Math.max(0, Math.min(1, v / max));
  return { background: `color-mix(in srgb, ${f > 0.7 ? "var(--approved)" : f > 0.4 ? "var(--hold)" : "var(--declined)"} ${Math.round(8 + f * 22)}%, transparent)` };
}

export function RubricPanel({ policy: p, result, onOpen }: { policy: Policy; result?: RunResult | null; onOpen?: (key: string) => void }) {
  const s = p.score, c = p.capex, b = p.bars, t = p.timeline, cn = p.cannibalisation;
  const barHigh = b.approval + b.priorityAdjust.High, barLow = b.approval + b.priorityAdjust.Low;
  const total = s.capital.max + s.experience.max + s.space.max + s.timeline.max + s.territory.max;
  const ledger = useMemo(() => (result ? reasonLedger(result, p) : []), [result, p]);
  const groups = useMemo(() => (result ? groupAverages(result) : []), [result]);
  const hist = useMemo(() => (result ? histogram(result) : null), [result]);
  const cards = useMemo(() => (result ? scorecard(result) : []), [result]);
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const n = result?.decisions.length ?? 0;
  const count = (st: Status) => result?.decisions.filter((d) => d.status === st).length ?? 0;
  const fw = groups.find((g) => g.group === "Moving forward");
  const hold = groups.find((g) => g.group === "On hold");
  const sep = fw && hold && hold.n && fw.total !== null ? AREAS.map((a) => ({ a, gap: (fw.areas[a.key] ?? 0) - (hold.areas[a.key] ?? 0) })).sort((x, y) => y.gap - x.gap)[0] : null;
  const rowsAll = cards.filter((r) => (filter === "ALL" || r.status === filter) && (!q.trim() || [r.id, r.name, r.territory ?? "", r.decidedBy].some((x) => x.toLowerCase().includes(q.trim().toLowerCase()))));
  const rows = showAll ? rowsAll : rowsAll.slice(0, 40);

  const nav = [["evidence", "Why they were selected or held"], ["points", "How points are calculated"], ["rules", "Rules, bars and ranking"], ["scorecard", "Every applicant"], ["money", "Money and plan"]];
  return (
    <div className="text-[13.5px] leading-relaxed text-ink-2" data-testid="rubric">
      <p className="text-ink">
        Every application goes through four steps: <b>hard rules</b> (pass or fail), a <b>score out of {total}</b>, a <b>bar</b> to clear, and a <b>ranking</b> when applicants compete.
        Names, language and notes never change the score. The AI never decides anything.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {[["1 · Hard rules", "Pass or fail. A fail means Declined or On hold, never a low score."], ["2 · Score", `${total} points over five areas, from the file's own numbers.`], ["3 · Bar", `Approval at ${b.approval} (${barHigh} High, ${barLow} Low). Under ${b.decline} is declined.`], ["4 · Rank", "Ready site, then score, then investment. Best ranks fill the usable slots."]].map(([h, d]) => (
          <div key={h} className="rounded-lg border border-line bg-surface-2/40 px-3 py-2"><div className="text-[12px] font-semibold text-ink">{h}</div><div className="mt-0.5 text-[12.5px]">{d}</div></div>
        ))}
      </div>
      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Rubric sections">
        {nav.filter(([id]) => result || id !== "evidence" && id !== "scorecard").map(([id, l]) => (
          <a key={id} href={`#rubric-${id}`} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-2 hover:bg-surface-2 hover:text-ink" onClick={(e) => { e.preventDefault(); document.getElementById(`rubric-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{l}</a>
        ))}
      </nav>

      {result && (
        <>
          <H id="rubric-evidence" n="A">Why they were selected or held: the numbers from this file</H>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
            {([["Applications", n, null], ["Approved", count("APPROVED"), "APPROVED"], ["Conditional", count("CONDITIONAL"), "CONDITIONAL"], ["Waitlisted", count("WAITLISTED"), "WAITLISTED"], ["On hold", count("ON_HOLD"), "ON_HOLD"], ["Declined", count("DECLINED"), "DECLINED"]] as const).map(([l, v, st]) => (
              <div key={l} className="rounded-lg border border-line px-3 py-2">
                <div className="num text-[22px] font-semibold" style={st ? { color: STATUS_VAR[st] } : undefined}>{v}</div>
                <div className="text-[12px] text-muted">{l}{n ? ` · ${Math.round((v / n) * 100)}%` : ""}</div>
              </div>
            ))}
          </div>

          <h4 className="mt-6 text-[14px] font-semibold text-ink">A1. The reason behind every outcome</h4>
          <Read>each row is one rule. "Applicants" is how many people that rule decided; the examples are real IDs from the file.</Read>
          <Table
            head={["Outcome", "Decided by", "The rule", "Applicants", "Avg score", "Examples"]}
            widths={["11%", "17%", "34%", "12%", "8%", "18%"]}
            small
            rows={ledger.map((r, i) => [
              ledger[i - 1]?.status === r.status ? "" : <span key="s"><Dot s={r.status} />{VERDICT_SHORT[r.status]}</span>,
              r.label,
              r.rule,
              <span key="c" className="num"><b className="text-ink">{r.count}</b> <span className="text-muted">· {r.pct}%</span><span className="mt-1 block h-1.5 rounded-full bg-surface-2"><i className="block h-full rounded-full" style={{ width: `${Math.min(100, r.pct * 2)}%`, background: STATUS_VAR[r.status] }} /></span></span>,
              <span key="a" className="num">{num(r.avgScore)}</span>,
              <span key="e" className="num text-[12px]">{r.ids.slice(0, 5).join(", ")}{r.ids.length > 5 ? ` +${r.ids.length - 5}` : ""}</span>,
            ])}
          />

          <h4 className="mt-7 text-[14px] font-semibold text-ink">A2. What separates the selected from the rest</h4>
          <Read>average points per area for each outcome. The wider the gap between "Moving forward" and "On hold", the more that area explains who got through.</Read>
          <Table
            head={["Area (max points)", ...GROUPS.map((g) => `${g} (${groups.find((x) => x.group === g)?.n ?? 0})`), "Gap: moving forward − on hold"]}
            small
            rows={[
              ...AREAS.map((a) => [
                `${a.label} (${MAXES[a.key]})`,
                ...groups.map((g) => <span key={g.group} className="num rounded px-1.5 py-0.5" style={heat(g.areas[a.key], MAXES[a.key])}>{num(g.areas[a.key])}</span>),
                fw && hold && hold.n ? <b key="g" className={`num ${sep?.a.key === a.key ? "text-neon" : "text-ink"}`}>{(((fw.areas[a.key] ?? 0) - (hold.areas[a.key] ?? 0)) >= 0 ? "+" : "") + num((fw.areas[a.key] ?? 0) - (hold.areas[a.key] ?? 0))}</b> : "–",
              ]),
              [`Total score (${total})`, ...groups.map((g) => <b key={g.group} className="num text-ink">{num(g.total)}</b>), fw && hold && hold.n && fw.total !== null && hold.total !== null ? <b key="gt" className="num text-ink">{num(fw.total - hold.total)}</b> : "–"],
              ["Funds as % of estimate", ...groups.map((g) => <span key={g.group} className="num">{g.fundsPct === null ? "–" : `${g.fundsPct}%`}</span>), "–"],
            ]}
          />
          {sep && sep.gap > 0 && <p className="mt-2 text-[13px] text-ink">The biggest separator is <b>{sep.a.label}</b>: applicants moving forward average {num(fw!.areas[sep.a.key])} of {MAXES[sep.a.key]} points against {num(hold!.areas[sep.a.key])} for those on hold (+{num(sep.gap)}).</p>}

          {hist && (
            <>
              <h4 className="mt-7 text-[14px] font-semibold text-ink">A3. Where the scores fall against the bars</h4>
              <Read>each column is a 10-point score range, coloured by outcome. A score is not the whole story: an applicant on hold can score high and still wait for a missing detail.</Read>
              <div className="mt-3 rounded-lg border border-line p-3">
                <div className="relative grid h-44 grid-cols-10 items-end gap-1.5">
                  {hist.bins.map((bin) => {
                    const maxT = Math.max(1, ...hist.bins.map((x) => x.total));
                    return (
                      <div key={bin.lo} className="flex h-full flex-col justify-end" title={`${bin.lo}–${bin.hi}: ${bin.total} applicants`}>
                        <div className="num mb-1 text-center text-[11px] text-muted">{bin.total || ""}</div>
                        <div className="flex flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${(bin.total / maxT) * 82}%` }}>
                          {STATUS_ORDER.filter((st) => bin.byStatus[st]).map((st) => <i key={st} style={{ background: STATUS_VAR[st], height: `${(bin.byStatus[st] / bin.total) * 100}%` }} />)}
                        </div>
                      </div>
                    );
                  })}
                  {[[b.decline, `Decline bar ${b.decline}`], [b.approval, `Approval bar ${b.approval}`]].map(([v, l]) => (
                    <div key={String(l)} className="pointer-events-none absolute inset-y-0 border-l border-dashed border-ink/50" style={{ left: `${Number(v)}%` }}>
                      <span className="absolute -top-0.5 left-1 whitespace-nowrap text-[10.5px] text-ink-2">{l}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-10 gap-1.5 text-center text-[11px] text-muted">{hist.bins.map((x) => <span key={x.lo}>{x.lo}</span>)}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-[12px]">{STATUS_ORDER.slice(0, 5).map((st) => <span key={st}><Dot s={st} />{VERDICT_SHORT[st]}</span>)}{hist.unscored > 0 && <span className="text-muted">{hist.unscored} not scored yet (missing details)</span>}</div>
              </div>
            </>
          )}
        </>
      )}

      <H id="rubric-points" n="B">How points are calculated</H>
      <Read>each area has a formula with a maximum. The numbers are this Policy's values, so editing the Policy changes this page.</Read>
      <Table
        head={["Area", "Max", "Formula"]}
        widths={["17%", "7%", "76%"]}
        small
        rows={[
          ["Funds vs estimate", String(s.capital.max), <span key="f">Let <code className={mono}>ratio = declared funds ÷ estimated cost</code>. <code className={mono}>ratio ≥ {Math.round(s.capital.fullAtRatio * 100)}%</code> → <b>{s.capital.max}</b>. <code className={mono}>100% to {Math.round(s.capital.fullAtRatio * 100)}%</code> → <b>{s.capital.atRatioOne} + {s.capital.max - s.capital.atRatioOne} × (ratio − 1) ÷ {num(s.capital.fullAtRatio - 1, 2)}</b>. <code className={mono}>{c.declineBelowPct}% to 100%</code> → <b>{s.capital.atRatioOne} × (ratio − 0.7) ÷ 0.3</b>. Under {c.declineBelowPct}% → 0 and the application is declined.</span>],
          ["Experience", String(s.experience.max), <span key="e"><code className={mono}>{s.experience.yearsPoints} × min(years, {s.experience.yearsCap}) ÷ {s.experience.yearsCap}</code> + <b>{s.experience.relevancePoints}</b> if the current or past business is directly relevant, <b>{s.experience.relevancePoints / 2}</b> if partly relevant.</span>],
          ["Space readiness", String(s.space.max), <span key="s"><code className={mono}>tenure + size + floor</code>. Tenure: Owned <b>{s.space.tenure.Owned}</b>, Rented <b>{s.space.tenure.Rented}</b>. Size (up to <b>{s.space.sizePoints}</b>): at or above the ideal size {s.space.sizePoints} ({num(s.space.sizePoints * 0.75)} if over 3× ideal); between minimum and ideal <code className={mono}>{s.space.sizePoints / 2} + {s.space.sizePoints / 2} × (size − min) ÷ (ideal − min)</code>; from 70% of the minimum {s.space.sizePoints / 4}; below that 0. Floor: Ground <b>{s.space.floor.retail.Ground}</b>, Mall <b>{s.space.floor.retail.Mall}</b>, Upper <b>{s.space.floor.retail.Upper}</b>, unknown 0. No site yet: a flat <b>{s.space.noSiteCredit}</b>.</span>],
          ["Timing", String(s.timeline.max), <span key="t"><code className={mono}>weeks available = target months × {t.weeksPerMonth}</code> against the weeks the plan needs. Enough time → <b>{s.timeline.max}</b>; otherwise <code className={mono}>max({s.timeline.minPoints}, {s.timeline.max} × available ÷ needed)</code>. No target given → <b>{s.timeline.unknownPoints}</b>.</span>],
          ["Location", String(s.territory.max), <span key="l"><code className={mono}>priority + max(0, {s.territory.cannibalisationPoints} − overlap penalty)</code>. Priority: High <b>{s.territory.priorityPoints.High}</b>, Medium <b>{s.territory.priorityPoints.Medium}</b>, Low <b>{s.territory.priorityPoints.Low}</b>. Penalty = <b>{cn.penaltyHigh}</b> if our nearest store is within {cn.highKm} km (<b>{cn.penaltyMedium}</b> within {cn.mediumKm} km), × a maturity weight: store open ≤ {cn.maturity[0].maxAgeYears} years {cn.maturity[0].weight}, ≤ {cn.maturity[1].maxAgeYears} years {cn.maturity[1].weight}, older {cn.maturity[2].weight}.</span>],
          ["Total", String(total), <span key="tt">Sum of the five areas, rounded. Names, language and free-text notes never enter any formula.</span>],
        ]}
      />
      <p className="mt-2 text-[12.5px] text-muted">Missing information is never scored as zero by guesswork: an unknown value is put on hold and asked for. Ideal and minimum shop sizes by city tier are in section E.</p>

      <H id="rubric-rules" n="C">Rules, bars and ranking</H>
      <h4 className="mt-3 text-[14px] font-semibold text-ink">C1. The five outcomes</h4>
      <Table
        head={["Outcome", "What it means", "When"]}
        widths={["20%", "28%", "52%"]}
        small
        rows={[
          [<span key="a"><Dot s="APPROVED" />Approved</span>, "Moving forward, holds a slot", "Passes every hard rule, score at or above the bar, and ranks inside the usable slots."],
          [<span key="c"><Dot s="CONDITIONAL" />Conditional</span>, `Slot reserved for ${p.windows.conditionalDays} days`, "Strong score, but still needs a qualifying site or a document check. Becomes Approved once verified."],
          [<span key="w"><Dot s="WAITLISTED" />Waitlisted</span>, "In the queue", "Eligible, but another applicant outranks them for the pin or the slot, or the score is under the bar. Moves up automatically if a slot opens."],
          [<span key="h"><Dot s="ON_HOLD" />On hold</span>, "We need information", `A detail is missing or contradicts another, or funds are short. Never uses a slot. Closes after ${p.windows.holdCloseDays} days with no reply.`],
          [<span key="d"><Dot s="DECLINED" />Declined</span>, "Not proceeding now", `Pin outside every open territory, funds under ${c.declineBelowPct}% of the estimate, score under ${b.decline}, or no free pin in the area.`],
        ]}
      />
      <h4 className="mt-6 text-[14px] font-semibold text-ink">C2. Hard rules: pass or fail, before any score</h4>
      <Table
        head={["Rule", "What is checked", "If it fails"]}
        widths={["22%", "48%", "30%"]}
        small
        rows={[
          ["Data is readable", "Pin, investment, space and size are present and agree with each other.", "On hold, with the exact detail needed"],
          ["Pin is in an open territory", "The pin code is covered by a territory that has open slots.", "Declined (redirect offered if one exists)"],
          ["One store per pin", "No pin repeats across our existing stores and the new stores.", "On hold or Waitlisted"],
          ["Slots", "Usable capacity = the smaller of open slots and free pins in the territory.", "Waitlisted"],
          ["Funds", `Funds against the estimated cost (section E). Below ${c.declineBelowPct}% is too low; ${c.declineBelowPct}% to 100% is a gap.`, `Declined below ${c.declineBelowPct}%, On hold between`],
          ["Spacing", `Two new stores closer than ${p.spacing.km} km to each other.`, "Only if slots remain"],
          ["City store cap", `Guide per city: Tier 1 ${p.density.capPerCityByTier["1"]}, Tier 2 ${p.density.capPerCityByTier["2"]}, Tier 3 ${p.density.capPerCityByTier["3"]} stores.`, "Flagged for a person"],
        ]}
      />
      <h4 className="mt-6 text-[14px] font-semibold text-ink">C3. The bars: which score is enough</h4>
      <Table
        head={["Territory priority", "Approval bar", "Below it"]}
        small
        rows={[["High", String(barHigh), "Waitlisted"], ["Medium", String(b.approval), "Waitlisted"], ["Low", String(barLow), "Waitlisted"], ["Any priority", `Under ${b.decline}`, "Declined"]]}
      />
      <p className="mt-2 text-[12.5px] text-muted">High-priority territories accept a lower score ({b.priorityAdjust.High} points); low-priority ones ask for more (+{b.priorityAdjust.Low}).</p>
      <h4 className="mt-6 text-[14px] font-semibold text-ink">C4. When applicants compete: who gets the slot</h4>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Applicants with a ready site go first.</li>
        <li>Then the higher score.</li>
        <li>Then the larger investment, then the lower application ID, so the result is always the same for the same file.</li>
        <li>Leftover slots are held for {p.windows.conditionalDays} days for strong applicants still finding a site.</li>
        <li>An approved partner is never replaced automatically. If someone new outranks them, the desk recommends a swap and a person must confirm it.</li>
      </ol>

      {result && (
        <>
          <H id="rubric-scorecard" n="D">Every applicant: the full scorecard</H>
          <Read>one row per applicant, every point in every area, the bar they faced, and the rule that decided. Click a row for the engine's own working. Green means a strong share of the maximum, amber middling, red weak.</Read>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["ALL", ...STATUS_ORDER.slice(0, 5)] as const).map((st) => (
              <button key={st} type="button" onClick={() => { setFilter(st); setShowAll(false); }} aria-pressed={filter === st} className={`rounded-full border px-3 py-1 text-[12.5px] ${filter === st ? "border-neon bg-surface-2 font-semibold text-ink" : "border-line text-ink-2 hover:bg-surface-2"}`}>
                {st === "ALL" ? `All ${n}` : <><Dot s={st} />{VERDICT_SHORT[st]} {count(st)}</>}
              </button>
            ))}
            <input value={q} onChange={(e) => { setQ(e.target.value); setShowAll(false); }} placeholder="Search ID, name, territory or rule" aria-label="Search the scorecard" className="ml-auto w-[240px] rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px] outline-none focus:border-neon" />
          </div>
          <div className="mt-2 overflow-x-auto rounded-lg border border-line" data-testid="scorecard">
            <table className="w-full min-w-[1020px] text-left text-[12.5px]">
              <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-2.5 py-2 font-semibold">Applicant</th><th className="px-2.5 py-2 font-semibold">Outcome</th>
                  {AREAS.map((a) => <th key={a.key} className="px-2 py-2 text-center font-semibold" title={a.label}>{a.label.split(" ")[0]} /{MAXES[a.key]}</th>)}
                  <th className="px-2 py-2 text-center font-semibold">Total /{total}</th><th className="px-2 py-2 text-center font-semibold">Bar</th><th className="px-2 py-2 text-center font-semibold">vs bar</th><th className="px-2 py-2 text-center font-semibold">Funds %</th><th className="px-2.5 py-2 font-semibold">Decided by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: ScoreRow) => (
                  <Fragment key={r.key}>
                    <tr className="cursor-pointer border-t border-line hover:bg-surface" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
                      <td className="px-2.5 py-1.5"><span className="num font-semibold text-ink">{r.id}</span> <span className="text-ink-2">{r.name}</span><div className="num text-[11px] text-muted">{r.territory ?? "no territory"}</div></td>
                      <td className="whitespace-nowrap px-2.5 py-1.5"><Dot s={r.status} />{VERDICT_SHORT[r.status]}</td>
                      {AREAS.map((a) => <td key={a.key} className="num px-2 py-1.5 text-center" style={heat(r.areas[a.key], MAXES[a.key])}>{num(r.areas[a.key])}</td>)}
                      <td className="num px-2 py-1.5 text-center font-bold text-ink">{r.total ?? "–"}</td>
                      <td className="num px-2 py-1.5 text-center">{r.bar ?? "–"}</td>
                      <td className="num px-2 py-1.5 text-center font-semibold" style={{ color: r.vsBar === null ? undefined : r.vsBar >= 0 ? "var(--approved)" : "var(--declined)" }}>{r.vsBar === null ? "–" : (r.vsBar >= 0 ? "+" : "") + r.vsBar}</td>
                      <td className="num px-2 py-1.5 text-center" style={r.fundsPct !== null && r.fundsPct < 100 ? { color: "var(--hold)" } : undefined}>{r.fundsPct === null ? "–" : `${r.fundsPct}%`}</td>
                      <td className="px-2.5 py-1.5 text-ink-2">{r.decidedBy}</td>
                    </tr>
                    {open === r.key && (
                      <tr className="border-t border-line bg-surface-2/40">
                        <td colSpan={11} className="px-4 py-3">
                          {r.notes.length ? (
                            <ul className="grid gap-1 text-[12.5px] sm:grid-cols-2">
                              {r.notes.map((x) => <li key={x.label}><b className="text-ink">{x.label}</b> <span className="num">{num(x.value)} / {x.max}</span>: {x.note}</li>)}
                            </ul>
                          ) : <p className="text-muted">Not scored yet: a required detail is missing, so the application is on hold with the exact detail requested.</p>}
                          {onOpen && <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(r.key); }} className="mt-2 rounded-full border border-line px-3 py-1 text-[12.5px] font-semibold hover:bg-surface-2">Open the full decision for {r.id}</button>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!rows.length && <tr><td colSpan={11} className="px-3 py-6 text-center text-muted">No applicant matches.</td></tr>}
              </tbody>
            </table>
          </div>
          {rowsAll.length > rows.length && <button type="button" onClick={() => setShowAll(true)} className="mt-2 rounded-full border border-line px-4 py-1.5 text-[12.5px] font-semibold hover:bg-surface-2">Show all {rowsAll.length} rows</button>}
        </>
      )}

      <H id="rubric-money" n="E">The money estimate and the opening plan</H>
      <p className="mt-2">
        Estimated cost = (fit-out + opening stock per sq ft) × shop size + franchise fee + rent deposit ({c.depositMonths} months, rented space only) + runway ({c.runwayMonths} months, rented space only) + {c.bufferPct}% buffer. Fit-out is costed on at most {c.formatMaxMultiple}× the ideal size.
      </p>
      <Table
        head={["City tier", "Fit-out ₹/sq ft", "Stock ₹/sq ft", "Fee ₹ lakh", "Ideal size", "Minimum size"]}
        small
        rows={(["1", "2", "3"] as const).map((k) => [`Tier ${k}`, String(c.fitoutPerSqft[k]), String(c.stockPerSqft[k]), String(c.franchiseFeeLakh[k]), `${c.idealSize[k]} sq ft`, `${c.minSize[k]} sq ft`])}
      />
      <p className="mt-2 text-[12.5px] text-muted">Illustrative planning assumptions, editable in Policy. Payback longer than {p.payback.flagAboveMonths} months is flagged.</p>
      <Table
        head={["Plan stage", "Weeks"]}
        small
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
        Everything on this page is read live from the <b>Policy</b> panel and the loaded file. Change a number there and this page, and every decision, updates.
      </p>
    </div>
  );
}
