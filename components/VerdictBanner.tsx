"use client";
// The verdict, first and big: one word, one plain sentence of why, what would change it, and the next step with its owner.
// Below it (when the full result is available): how the rubric scored it in plain words, and who came first.
import { CODE_LABEL } from "@/lib/engine/codes";
import { arrivalRace, type Lane } from "@/lib/engine/arrival";
import { plainReason, VERDICT_SHORT, VERDICT_WORD } from "@/lib/engine/plain";
import type { Decision, RunResult } from "@/lib/engine/types";
import { STATUS_VAR } from "./icons";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function VerdictBanner({ decision: d, change, compact = false, result }: { decision: Decision; change?: string; compact?: boolean; result?: RunResult }) {
  const color = STATUS_VAR[d.status];
  return (
    <div>
      <div className="rounded-[var(--radius-m)] border-l-[5px] px-4 py-3.5" style={{ borderColor: color, background: `color-mix(in srgb, ${color} 13%, transparent)` }} data-testid="verdict-banner" data-status={d.status}>
        <div className="flex items-center gap-2">
          <i className="inline-block size-2.5 rounded-full" style={{ background: color }} aria-hidden />
          <span className="font-[var(--font-hud)] text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Verdict</span>
        </div>
        <p className={`mt-1 font-[var(--font-hud)] font-bold uppercase leading-tight tracking-tight ${compact ? "text-[22px]" : "text-[28px]"}`} style={{ color }}>
          {VERDICT_WORD[d.status]}
        </p>
        <dl className="mt-3 grid gap-2.5 text-[14.5px] leading-snug">
          <div>
            <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Why, in one line</dt>
            <dd className="mt-0.5 text-ink">{plainReason(d)}</dd>
          </div>
          {change && (
            <div>
              <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">What would change it</dt>
              <dd className="mt-0.5 text-ink-2">{cap(change.replace(/^Smallest change that helps:\s*/, ""))}</dd>
            </div>
          )}
          <div>
            <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Next step · {d.owner}</dt>
            <dd className="mt-0.5 font-medium text-ink">{d.nextStep}</dd>
          </div>
        </dl>
      </div>
      {result && <RubricStrip decision={d} />}
      {result && <ArrivalChart result={result} decision={d} />}
    </div>
  );
}

const rate = (v: number, max: number) => {
  const f = v / max;
  return f >= 0.7 ? { word: "Strong", color: "var(--approved)" } : f >= 0.4 ? { word: "Middling", color: "var(--hold)" } : { word: "Weak", color: "var(--declined)" };
};

/** The rubric in plain words: the hard rules, then five areas, then the bar. */
export function RubricStrip({ decision: d }: { decision: Decision }) {
  const sc = d.score;
  const code = d.codes[0];
  const hard =
    d.status === "DECLINED" || d.status === "ON_HOLD" || (d.status === "WAITLISTED" && (code === "PIN_TAKEN" || code === "SLOTS_FULL"))
      ? { ok: false, text: code ? CODE_LABEL[code] : "A rule is not met" }
      : { ok: true, text: "Passed: pin free, in an open territory, funds high enough" };
  const weakest = sc ? [...sc.components].sort((a, b) => a.value / a.max - b.value / b.max)[0] : null;
  return (
    <section className="mt-3 rounded-[var(--radius-m)] border border-line px-4 py-3.5" data-testid="rubric-strip">
      <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted">How the rubric scored it</h4>
      <p className="mt-2 flex items-start gap-2 text-[13.5px]">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: `color-mix(in srgb, ${hard.ok ? "var(--approved)" : "var(--hold)"} 22%, transparent)`, color: hard.ok ? "var(--approved)" : "var(--hold)" }}>{hard.ok ? "✓" : "!"}</span>
        <span><b className="text-ink">Step 1, hard rules.</b> <span className="text-ink-2">{hard.text}</span></span>
      </p>
      {sc ? (
        <>
          <p className="mt-3 text-[13.5px]"><b className="text-ink">Step 2, five areas</b> <span className="text-muted">(points out of each maximum)</span></p>
          <ul className="mt-2 grid gap-2">
            {sc.components.map((c) => {
              const r = rate(c.value, c.max);
              return (
                <li key={c.key} className="text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="w-[112px] shrink-0 font-medium text-ink">{c.label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><i className="block h-full rounded-full" style={{ width: `${Math.min(100, (c.value / c.max) * 100)}%`, background: r.color }} /></span>
                    <span className="num w-[54px] shrink-0 text-right text-ink">{Math.round(c.value * 10) / 10}<span className="text-muted"> / {c.max}</span></span>
                    <span className="w-[62px] shrink-0 text-right text-[11.5px] font-semibold" style={{ color: r.color }}>{r.word}</span>
                  </div>
                  <p className="mt-0.5 pl-[120px] text-[12px] leading-snug text-muted">{cap(c.note)}</p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[13.5px]">
            <b className="text-ink">Step 3, the bar.</b>{" "}
            <span className="text-ink-2">
              Total <b className="num text-ink">{sc.total}</b> of 100{d.bar !== null ? <>, against a bar of <b className="num text-ink">{d.bar}</b> (<span style={{ color: sc.total >= d.bar ? "var(--approved)" : "var(--declined)" }}>{sc.total >= d.bar ? "+" : ""}{sc.total - d.bar}</span>).</> : "."}
              {weakest && weakest.value / weakest.max < 0.7 ? ` The most room to grow: ${weakest.label.toLowerCase()} (${Math.round(weakest.value * 10) / 10} of ${weakest.max}).` : ""}
            </span>
          </p>
        </>
      ) : (
        <p className="mt-3 text-[13.5px] text-ink-2"><b className="text-ink">Not scored yet.</b> A required detail is missing, so the application is on hold with the exact detail requested. Nothing is guessed as zero.</p>
      )}
    </section>
  );
}

/** Arrival order against the rank the rules give: who came first, and who moved past whom. */
export function ArrivalChart({ result, decision: d }: { result: RunResult; decision: Decision }) {
  const race = arrivalRace(result, d);
  if (!race) return null;
  // keep the picture readable: at most 11 lanes, centred on this applicant's rank
  let lanes: Lane[] = race.lanes;
  if (lanes.length > 11) {
    const byRank = [...lanes].sort((a, b) => a.rank - b.rank);
    const i = byRank.findIndex((l) => l.key === race.me.key);
    const start = Math.max(0, Math.min(byRank.length - 11, i - 5));
    lanes = byRank.slice(start, start + 11);
  }
  const left = [...lanes].sort((a, b) => a.arrival - b.arrival);
  const right = [...lanes].sort((a, b) => a.rank - b.rank);
  const H = 30, top = 30, W = 380;
  const yL = (l: Lane) => top + left.indexOf(l) * H + H / 2;
  const yR = (l: Lane) => top + right.indexOf(l) * H + H / 2;
  const height = top + lanes.length * H + 6;
  return (
    <section className="mt-3 rounded-[var(--radius-m)] border border-line px-4 py-3.5" data-testid="arrival-chart">
      <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted">Who came first</h4>
      <p className="mt-1.5 text-[14px] font-semibold text-ink">{race.headline}</p>
      <svg viewBox={`0 0 ${W} ${height}`} className="mt-2 w-full" role="img" aria-label={`${race.headline} Lines join each application's arrival position to its rank.`}>
        <text x="0" y="14" className="fill-[var(--muted)]" fontSize="10" fontWeight="700" letterSpacing="1.2">ARRIVED</text>
        <text x={W} y="14" textAnchor="end" className="fill-[var(--muted)]" fontSize="10" fontWeight="700" letterSpacing="1.2">RANKED BY THE RULES</text>
        {left.map((l) => {
          const me = l.key === race.me.key;
          const c = STATUS_VAR[l.status];
          const y1 = yL(l), y2 = yR(l);
          return (
            <g key={l.key}>
              <path d={`M128 ${y1} C 190 ${y1}, 190 ${y2}, 252 ${y2}`} fill="none" stroke={me ? "var(--neon)" : c} strokeWidth={me ? 4 : 2} opacity={me ? 1 : 0.5} strokeLinecap="round" />
              <circle cx="128" cy={y1} r={me ? 5.5 : 4} fill={c} stroke={me ? "#fff" : "none"} strokeWidth="1.5" />
              <circle cx="252" cy={y2} r={me ? 5.5 : 4} fill={c} stroke={me ? "#fff" : "none"} strokeWidth="1.5" />
              <text x="0" y={y1 + 4} fontSize="11.5" fontWeight={me ? 700 : 500} className={me ? "fill-[var(--ink)]" : "fill-[var(--ink-2)]"}>{l.arrival} · {l.id}{l.seen ? ` · ${new Date(l.seen).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</text>
              <text x={W} y={y2 + 4} textAnchor="end" fontSize="11.5" fontWeight={me ? 700 : 500} className={me ? "fill-[var(--ink)]" : "fill-[var(--ink-2)]"}>{l.rank} · {l.score !== null ? `score ${l.score}` : "no score yet"} · {VERDICT_SHORT[l.status]}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-[13px] leading-snug text-ink-2">{race.detail}</p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{race.byDate ? "Arrival is the date each application was first uploaded on this browser (see Upload history); same-day applications go by application number." : "The file has no submission dates, so the application number is used as arrival order."} The rules rank a ready site first, then score, then investment, then the earlier application.</p>
    </section>
  );
}
