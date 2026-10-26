"use client";

import { useMemo, useState } from "react";
import { briefText, buildBrief } from "@/lib/engine/brief";
import type { Policy } from "@/lib/engine/policy";
import type { Dataset, RunResult } from "@/lib/engine/types";

export function BriefView({ result, dataset, policy, today, onSelect }: { result: RunResult; dataset: Dataset; policy: Policy; today: string; onSelect: (key: string) => void }) {
  const b = useMemo(() => buildBrief(result, dataset, policy, today), [result, dataset, policy, today]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(briefText(b));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  const nice = new Date(b.date + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin bg-bg p-4">
      <style>{`@media print { header, [data-no-print] { display: none !important; } html, body { background: #fff !important; color: #000 !important; } .brief-doc { border: 0 !important; background: #fff !important; color: #000 !important; box-shadow: none !important; } .brief-doc * { color: #000 !important; border-color: #ccc !important; } }`}</style>
      <div className="mx-auto w-full max-w-[860px]">
        <div data-no-print className="mb-3 flex flex-wrap items-center gap-2">
          <p className="mr-auto text-[13px] text-ink-2">A one-page summary of this file for a manager. Click a decision to open it.</p>
          <button type="button" onClick={copy} className="rounded-full border border-line px-3.5 py-1.5 text-[13px] hover:bg-surface-2">{copied ? "Copied" : "Copy as text"}</button>
          <button type="button" onClick={() => window.print()} className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold" style={{ background: "var(--neon)", color: "var(--on-neon)" }}>Print or save as PDF</button>
        </div>

        <article className="brief-doc rounded-[var(--radius-l)] border border-line bg-surface p-8 sm:p-10">
          <p className="text-[12px] uppercase tracking-wide text-muted">Expansion brief</p>
          <h2 className="serif mt-1 text-[26px] font-semibold leading-tight">{b.headline}</h2>
          <p className="mt-2 text-[12.5px] text-muted">{nice} · {b.fileName}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-line py-4 sm:grid-cols-4">
            {b.numbers.map((n) => (
              <div key={n.label}>
                <dt className="text-[12px] text-muted">{n.label}</dt>
                <dd className="num mt-0.5 text-[20px] font-semibold">{n.value}</dd>
              </div>
            ))}
          </dl>

          {b.sections.map((s) => (
            <section key={s.title} className="mt-6 break-inside-avoid">
              <h3 className="text-[14px] font-semibold">{s.title}</h3>
              <ul className="mt-2 space-y-1.5">
                {s.items.map((i, idx) => (
                  <li key={idx} className="flex gap-2 text-[13.5px] leading-snug text-ink-2">
                    <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-neon" />
                    {i.key ? (
                      <button type="button" onClick={() => onSelect(i.key!)} className="text-left hover:text-ink hover:underline">{i.text}</button>
                    ) : (
                      <span>{i.text}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="mt-8 border-t border-line pt-3 text-[11.5px] text-muted">Money figures are illustrative planning estimates, not forecasts. Every decision follows written rules and can be explained from its card.</p>
        </article>
        <div className="h-24" />
      </div>
    </div>
  );
}
