"use client";

import { useEffect, useMemo, useState } from "react";
import { buildOrderHeat, heatAsks, type PinIndex, FLOOR_FACTOR, ORDERS_PER_MONTH, RAMP_MONTHS, START_SHARE } from "@/lib/engine/orders";
import type { Policy } from "@/lib/engine/policy";
import type { Dataset, RunResult } from "@/lib/engine/types";

// one request per set of pin codes, shared by every render (React runs effects twice in development)
const inflight = new Map<string, Promise<{ pins?: PinIndex }>>();
function askModel(items: { pin: string; city: string; tier: number }[]): Promise<{ pins?: PinIndex }> {
  const key = items.map((i) => i.pin).join(",");
  let p = inflight.get(key);
  if (!p) {
    p = fetch("/api/heat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items }) }).then((r) => (r.ok ? r.json() : { pins: {} })).catch(() => ({ pins: {} }));
    inflight.set(key, p);
  }
  return p;
}
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

export function OrdersHeat({ result, dataset, policy, today, onSelect }: { result: RunResult; dataset: Dataset; policy: Policy; today: string; onSelect: (key: string) => void }) {
  const asks = useMemo(() => heatAsks(result, dataset, policy, today), [result, dataset, policy, today]);
  const asksKey = asks.map((a) => a.pin).join(",");
  const [pinIndex, setPinIndex] = useState<PinIndex>({});
  const [source, setSource] = useState<"loading" | "ai" | "rule">("loading");
  // Ask the model once for a relative demand index per pin code. Any failure leaves the tier averages in place.
  useEffect(() => {
    if (!asks.length) return;
    let live = true;
    setSource("loading");
    const chunks: (typeof asks)[] = [];
    for (let i = 0; i < asks.length; i += 80) chunks.push(asks.slice(i, i + 80));
    Promise.all(chunks.map((items) => askModel(items)))
      .then((parts) => {
        if (!live) return;
        const merged: PinIndex = Object.assign({}, ...parts.map((p) => p.pins ?? {}));
        setPinIndex(merged);
        setSource(Object.keys(merged).length ? "ai" : "rule");
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asksKey]);
  const heat = useMemo(() => buildOrderHeat(result, dataset, policy, today, pinIndex), [result, dataset, policy, today, pinIndex]);
  const [all, setAll] = useState(false);
  const shown = all ? heat.rows : heat.rows.slice(0, 12);
  const newCount = heat.rows.filter((r) => r.kind === "new").length;
  const cols = `minmax(150px,1.6fr) repeat(${heat.months.length}, minmax(44px,1fr)) minmax(56px,0.8fr)`;

  return (
    <section className="rounded-[var(--radius-l)] border border-line bg-surface p-4" aria-label="Assumed orders by store">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[13.5px] font-semibold text-ink">Assumed orders by store</h3>
        <span className="text-[12px] text-muted">
          {heat.rows.length - newCount} existing stores and {newCount} new partners, next {heat.months.length} months. Illustrative: there is no order data in the file.
        </span>
        <span className="ml-auto rounded-full border px-2.5 py-0.5 text-[11.5px]" style={source === "ai" ? { borderColor: "var(--neon)", color: "var(--ink)" } : { borderColor: "var(--line-strong)", color: "var(--muted)" }} title={source === "ai" ? "The pin-code index is an AI guess from what the model knows about each area. It is not data." : "Using the average for each city tier."}>
          {source === "loading" ? "Asking the model about each pin code…" : source === "ai" ? "Pin-code index: AI estimate" : "Pin-code index: tier averages"}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="grid items-end gap-[2px] pb-1 text-[11px] text-muted" style={{ gridTemplateColumns: cols }}>
            <span>Store</span>
            {heat.months.map((m) => (
              <span key={m} className="text-center">{m.slice(0, 3)}<span className="block text-[10px] opacity-70">{m.slice(4)}</span></span>
            ))}
            <span className="text-right">Mature</span>
          </div>
          {shown.map((r) => {
            const Tag = r.key ? "button" : "div";
            return (
              <Tag key={r.id} {...(r.key ? { type: "button" as const, onClick: () => onSelect(r.key!), title: `Open ${r.id}` } : {})} className={`grid w-full items-center gap-[2px] py-[1px] text-left ${r.key ? "cursor-pointer hover:bg-surface-2" : ""}`} style={{ gridTemplateColumns: cols }}>
                <span className="truncate pr-2 text-[12px] text-ink-2">
                  <span className="inline-block size-1.5 rounded-full align-middle" style={{ background: r.kind === "existing" ? "var(--muted)" : r.status === "APPROVED" ? "var(--approved)" : "var(--conditional)" }} aria-hidden />{" "}
                  {r.label}
                </span>
                {r.cells.map((c, i) => {
                  const p = c / heat.max;
                  return (
                    <span key={i} title={`${r.id}, ${heat.months[i]}: about ${c} orders${r.pin ? ` · pin ${r.pin}, index ${r.index}${r.why ? `: ${r.why}` : ""}` : ""}`} className="num grid h-7 place-items-center rounded-[4px] text-[11px]" style={{ background: c ? `color-mix(in srgb, var(--neon) ${Math.round(12 + p * 88)}%, var(--surface-3))` : "transparent", border: c ? undefined : "1px dashed var(--line)", color: p > 0.55 ? "var(--on-neon)" : "var(--ink-2)" }}>
                      {c ? fmt(c) : ""}
                    </span>
                  );
                })}
                <span className="num text-right text-[12px] font-semibold" title={r.pin ? `Pin ${r.pin}: index ${r.index}${r.why ? `. ${r.why}` : ""}` : undefined}>{fmt(r.steady)}</span>
              </Tag>
            );
          })}
          <div className="mt-1 grid items-center gap-[2px] border-t border-line pt-1.5 text-[12px]" style={{ gridTemplateColumns: cols }}>
            <span className="font-medium text-ink">All stores</span>
            {heat.totalByMonth.map((t, i) => (
              <span key={i} className="num text-center text-ink-2">{fmt(t)}</span>
            ))}
            <span />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted">
        <span className="flex items-center gap-2">Fewer orders
          <span aria-hidden className="inline-block h-2.5 w-28 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--neon) 12%, var(--surface-3)), var(--neon))" }} />
          More
        </span>
        <span className="flex items-center gap-1.5"><i className="inline-block size-3 rounded-[3px]" style={{ border: "1px dashed var(--line-strong)" }} /> Not open yet</span>
        {heat.rows.length > 12 && (
          <button type="button" onClick={() => setAll((v) => !v)} className="ml-auto rounded-full border border-line px-3 py-1 text-ink-2 hover:bg-surface-2">{all ? "Show the top 12" : `Show all ${heat.rows.length} stores`}</button>
        )}
      </div>
      <p className="mt-2 text-[11.5px] leading-snug text-muted">
        How it is assumed: a mature ideal-size store takes about {ORDERS_PER_MONTH[1]}, {ORDERS_PER_MONTH[2]} and {ORDERS_PER_MONTH[3]} orders a month in Tier 1, 2 and 3 cities. Volume scales with the store&apos;s size against the ideal and with the shop&apos;s position (ground 1.0, mall {FLOOR_FACTOR.Mall}, upper floor {FLOOR_FACTOR.Upper}). A new store starts at {Math.round(START_SHARE * 100)}% and reaches full volume after {RAMP_MONTHS} months. New stores begin on the opening date in their onboarding plan. The pin-code index (0.5 to 1.5, where 1 is a typical store in the tier) comes from a language model that is told only the pin code, city and tier; hover a figure to see its reason. It is a rough guess, and no decision reads it.
      </p>
    </section>
  );
}
