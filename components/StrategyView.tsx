"use client";
// Strategy: two plain answers built from the engine's own decisions.
// "Where should we expand?" ranks territories by a written rule. "Who should we invest our time in?" groups partners by what
// the engine can prove. Every verdict shows its reason in numbers; nothing here changes a decision.
import { useMemo, useRef, useState } from "react";
import { useScrollReveal, Words } from "./motion";
import { fmtDate } from "@/lib/engine/plan";
import type { Step } from "@/lib/engine/session";
import { GROUP_LABEL, GROUP_RULE, VERDICT_LABEL, VERDICT_RULE, partnerShortlist, territoryRanking, type PartnerRow, type ShortlistGroup, type TerritoryVerdict } from "@/lib/engine/strategy";
import { STATUS_LABEL } from "./icons";

const VERDICT_TONE: Record<TerritoryVerdict, string> = {
  expand: "var(--approved)",
  recruit: "var(--neon, #8f7cff)",
  hold: "var(--hold)",
  blocked: "var(--declined)",
  full: "var(--line-strong)",
};
const GROUP_TONE: Record<ShortlistGroup, string> = { invest: "var(--approved)", fix: "var(--hold)", walk: "var(--declined)" };

export function StrategyView({ step, today, onOpenTerritory, onOpenPartner }: { step: Step; today: string; onOpenTerritory: (key: string) => void; onOpenPartner: (key: string) => void }) {
  const rows = useMemo(() => territoryRanking(step), [step]);
  const list = useMemo(() => partnerShortlist(step, today), [step, today]);
  const [group, setGroup] = useState<ShortlistGroup>("invest");
  const root = useRef<HTMLElement>(null);
  useScrollReveal(root, [group, rows.length]);
  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.verdict] = (m[r.verdict] ?? 0) + 1), m), {});
  const shown = list[group];
  const num = (v: number | null, d = 1) => (v === null ? "–" : (Math.round(v * 10 ** d) / 10 ** d).toString());

  return (
    <main ref={root} className="flex-1 overflow-y-auto lg:flex-none px-4 py-5 lg:h-[calc(100dvh-53px)] lg:px-8" data-testid="strategy">
      <div className="mx-auto grid max-w-[1180px] gap-10">
        {/* 1. Where to expand */}
        <section aria-labelledby="where">
          <h2 id="where" data-reveal="heading" className="text-[20px] font-semibold"><Words text="Where should we expand?" /></h2>
          <p data-reveal="fade" className="mt-1 max-w-[760px] text-[13.5px] text-ink-2">
            Every territory gets one verdict from a written rule, best place to act first. Within a verdict, High priority comes first, then bigger cities, then more open slots.
          </p>
          <div data-reveal="group" className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
            {(Object.keys(VERDICT_LABEL) as TerritoryVerdict[]).map((v) => (
              <span key={v} className="rounded-full border border-line px-2.5 py-1" title={VERDICT_RULE[v]}>
                <i className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: VERDICT_TONE[v] }} aria-hidden />
                {VERDICT_LABEL[v]} <b className="num" data-count={counts[v] ?? 0}>{counts[v] ?? 0}</b>
              </span>
            ))}
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="bg-surface-2 text-[12px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Territory</th>
                  <th className="px-3 py-2 font-medium">Verdict</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Slots free</th>
                  <th className="px-3 py-2 font-medium">Waiting</th>
                  <th className="px-3 py-2 font-medium">Median score</th>
                  <th className="px-3 py-2 font-medium">Why</th>
                </tr>
              </thead>
              <tbody data-reveal="rows">
                {rows.map((r) => (
                  <tr key={r.key} className="cursor-pointer border-t border-line align-top hover:bg-surface" onClick={() => onOpenTerritory(r.key)}>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.id}</div>
                      <div className="text-[12px] text-muted">{r.city ?? "–"}{r.tier ? ` · Tier ${r.tier}` : ""}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium" style={{ color: VERDICT_TONE[r.verdict] }}>{VERDICT_LABEL[r.verdict]}</td>
                    <td className="px-3 py-2">{r.priority ?? "–"}</td>
                    <td className="num px-3 py-2">{r.remaining} free<div className="text-[11.5px] text-muted">of {r.usable} usable{r.usable < r.slots ? `, ${r.slots} in file` : ""}</div></td>
                    <td className="num px-3 py-2">{r.waiting}</td>
                    <td className="num px-3 py-2">{num(r.medianScore)}</td>
                    <td className="px-3 py-2 text-ink-2">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 max-w-[900px] text-[12px] text-muted">
            Rules, first match wins. Blocked: {VERDICT_RULE.blocked} Full: {VERDICT_RULE.full} Hold: {VERDICT_RULE.hold} Recruit: {VERDICT_RULE.recruit} Expand: {VERDICT_RULE.expand} Click a row to see that territory's applications. Demand beyond the file (population, footfall, rivals) is not known and is not guessed.
          </p>
        </section>

        {/* 2. Who to invest in */}
        <section aria-labelledby="who">
          <h2 id="who" data-reveal="heading" className="text-[20px] font-semibold"><Words text="Who should we invest our time in?" /></h2>
          <p data-reveal="fade" className="mt-1 max-w-[760px] text-[13.5px] text-ink-2">Partners sorted by what the engine can prove: funds against the estimated need, estimated payback, risk flags and how soon they could open.</p>
          <div data-reveal="group" className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Partner groups">
            {(Object.keys(GROUP_LABEL) as ShortlistGroup[]).map((g) => (
              <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)} className={`rounded-full border px-3.5 py-1.5 text-[13px] ${group === g ? "border-neon bg-surface-2 font-semibold" : "border-line hover:bg-surface-2"}`}>
                <i className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: GROUP_TONE[g] }} aria-hidden />
                {GROUP_LABEL[g]} <b className="num" data-count={list[g].length}>{list[g].length}</b>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-muted">{GROUP_RULE[group]}</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="bg-surface-2 text-[12px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Applicant</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium" title="Illustrative: estimated months to pay back the investment">Payback (est.)</th>
                  <th className="px-3 py-2 font-medium" title="Declared funds minus the estimated need, ₹ lakh">Funds vs need</th>
                  <th className="px-3 py-2 font-medium">Opens</th>
                  <th className="px-3 py-2 font-medium">{group === "fix" ? "Fix that moves them" : group === "walk" ? "Why not" : "Main risk and next step"}</th>
                </tr>
              </thead>
              <tbody key={group} data-reveal="rows">
                {shown.map((r: PartnerRow) => (
                  <tr key={r.key} className="cursor-pointer border-t border-line align-top hover:bg-surface" onClick={() => onOpenPartner(r.key)}>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.name || r.id}</div>
                      <div className="num text-[12px] text-muted">{r.id}{r.territoryId ? ` · ${r.territoryId}` : ""}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{STATUS_LABEL[r.status]}</td>
                    <td className="num px-3 py-2">{num(r.score, 0)}</td>
                    <td className="num px-3 py-2">{r.paybackMonths === null ? "–" : `${num(r.paybackMonths)} mo`}</td>
                    <td className="num px-3 py-2" style={r.fundsGap !== null && r.fundsGap < 0 ? { color: "var(--hold)" } : undefined}>
                      {r.invest === null || r.required === null ? "–" : `₹${num(r.invest)} / ₹${num(r.required)} L`}
                      {r.fundsGap !== null && r.fundsGap < 0 && <div className="text-[11.5px]">short by ₹{num(-r.fundsGap)} L</div>}
                    </td>
                    <td className="num px-3 py-2 whitespace-nowrap">{r.readyBy ? fmtDate(r.readyBy) : "–"}{r.weeksToOpen ? <div className="text-[11.5px] text-muted">{r.weeksToOpen} weeks</div> : null}</td>
                    <td className="px-3 py-2 text-ink-2">
                      {group === "fix" ? <>{r.fix} <span className="text-muted">would move them to</span> <b className="text-ink">{r.fixTo ? STATUS_LABEL[r.fixTo] : ""}</b></> : group === "walk" ? r.action : <>{r.risk && <div style={{ color: "var(--hold)" }}>{r.risk}</div>}<div>{r.action}</div></>}
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted">{group === "fix" ? "No held applicant is one small change away." : "Nobody in this group."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-muted">Payback uses the editable illustrative assumptions in Policy. "One fix away" is tested by re-running the engine with that single change, for the {step.dataset.applications.length > 250 ? "4" : "12"} strongest held applicants.</p>
        </section>
      </div>
    </main>
  );
}
