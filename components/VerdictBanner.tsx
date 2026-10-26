"use client";
// The verdict, first and big: one word, one plain sentence of why, what would change it, and the next step with its owner.
// The engine's technical sentence stays in the evidence below for anyone who wants the full rule text.
import { plainReason, VERDICT_WORD } from "@/lib/engine/plain";
import type { Decision } from "@/lib/engine/types";
import { STATUS_VAR } from "./icons";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function VerdictBanner({ decision: d, change, compact = false }: { decision: Decision; change?: string; compact?: boolean }) {
  const color = STATUS_VAR[d.status];
  return (
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
          <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">Why</dt>
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
  );
}
