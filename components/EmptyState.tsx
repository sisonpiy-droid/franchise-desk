"use client";

import { CATEGORY_IDS, CATEGORY_PRESETS, type CategoryId } from "@/lib/engine/categories";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWordsIn } from "./motion";
import dynamic from "next/dynamic";
import { Icon } from "./icons";
import { cityPoints } from "@/lib/map/terrain";
import { PinLegend } from "./map/PinLegend";
import { loadKarnataka, territoryZones } from "@/lib/map/zones";
import { parseWorkbook } from "@/lib/parse/parse";
import { readWorkbook } from "@/lib/parse/xlsx";
import reference from "@/lib/engine/reference.json";

const FlatIndia = dynamic(() => import("./map/FlatIndia"), { ssr: false });
const Diorama = dynamic(() => import("./map/Diorama"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-[13px] text-muted">Building the 3D view of India…</div>,
});

export function EmptyState({ onFile, onSample, error, loading, category, onCategory }: { onFile: (f: File) => void; onSample: (openCity?: string) => void; error: string | null; loading: boolean; category: CategoryId; onCategory: (c: CategoryId) => void }) {
  const [over, setOver] = useState(false);
  const hero = useRef<HTMLDivElement>(null);
  useWordsIn(hero, 0.15);
  // before any upload, the pins count the requests in the bundled sample file (invented applicants), marked as sample
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/sample/sample-golden.xlsx")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((buf) => {
        const ds = parseWorkbook(readWorkbook(new Uint8Array(buf)), "sample", "sample");
        const c: Record<string, number> = {};
        for (const a of ds.applications) {
          const city = a.pin ? reference.cities.find((x) => x.prefix === a.pin!.slice(0, 3))?.city : undefined;
          if (city) c[city] = (c[city] ?? 0) + 1;
        }
        if (live) setCounts(c);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const points = useMemo(() => cityPoints().map((p) => (counts ? { ...p, count: counts[p.title] ?? 0 } : p)), [counts]);
  const [picked, setPicked] = useState<string | null>(null);
  const [ka, setKa] = useState<GeoJSON.Feature | null>(null);
  useEffect(() => {
    loadKarnataka().then(setKa);
  }, []);
  const zones = useMemo(() => territoryZones(points, ka), [points, ka]);
  const [reduced, setReduced] = useState(false);
  const [map3d, setMap3d] = useState(true);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return (
    // The first screen is only the map: India in 3D with the expansion cities, and one upload control floating on it
    <main
      className="relative isolate h-[calc(100dvh-53px)] w-full overflow-hidden"
      aria-label="3D map of India with the expansion cities"
      style={{ background: "radial-gradient(90% 70% at 55% 35%, #191a2b 0%, #07070b 70%)" }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      {map3d && <Diorama source={{ kind: "region" }} points={points} overlay={zones} activeKey={picked} onPick={(k) => onSample(points.find((p) => p.key === k)?.title)} reducedMotion={reduced} onFail={() => setMap3d(false)} autoRotate hint="Drag to rotate · scroll to zoom · click a city to see its requests" />}
      <div ref={hero} className="pointer-events-none absolute inset-x-0 top-5 z-[5] hidden px-4 text-center sm:block">
        <h1 className="flex flex-wrap items-center justify-center gap-x-[0.4em] font-[var(--font-hud)] text-[clamp(32px,4.8vw,64px)] font-bold uppercase leading-none tracking-[0.07em]" style={{ filter: "drop-shadow(0 0 20px rgba(60,242,192,.5)) drop-shadow(0 6px 20px rgba(0,0,0,.75))" }} aria-label="Your territories">
          <span aria-hidden className="inline-flex">
            {"YOUR".split("").map((ch, i) => <span key={i} className="word inline-block text-[#eafff5]">{ch}</span>)}
          </span>
          <span aria-hidden className="inline-flex items-center">
            {"TERRITORIES".split("").map((ch, i) =>
              ch === "O" ? (
                <span key={i} className="word relative inline-grid size-[0.82em] place-items-center align-middle" style={{ margin: "0 0.04em" }}>
                  <i className="pin-ring absolute inset-0 rounded-full border-[0.09em] border-[#3cf2c0]" />
                  <i className="pin-pulse absolute inset-0 rounded-full border-[0.05em] border-[#3cf2c0]" />
                  <i className="block size-[0.26em] rounded-full bg-[#eafff5]" style={{ boxShadow: "0 0 14px #3cf2c0" }} />
                </span>
              ) : (
                <span key={i} className="word shimmer-text inline-block">{ch}</span>
              ),
            )}
          </span>
        </h1>
        <div className="fade-in mx-auto mt-3 flex max-w-[520px] items-center gap-3" aria-hidden>
          <i className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #3cf2c0aa)" }} />
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none"><path d="M8 19s6-5.4 6-10.2A6 6 0 0 0 2 8.8C2 13.6 8 19 8 19Z" stroke="#9af0c4" strokeWidth="1.6" /><circle cx="8" cy="8.6" r="2.2" fill="#3cf2c0" /></svg>
          <i className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, #3cf2c0aa)" }} />
        </div>
        <p className="fade-in mt-2.5 text-[clamp(14px,1.5vw,19px)] tracking-wide text-[#d9fff0]" style={{ textShadow: "0 2px 18px rgba(0,0,0,.8)" }}>
          Live on the map. <span className="text-[#9af0c4]">Click on any to see its requests.</span>
        </p>
      </div>
      <PinLegend points={points} sample />
      {!map3d && <FlatIndia points={points} activeKey={picked} onPick={(k) => onSample(points.find((p) => p.key === k)?.title)} />}
      {over && <div className="pointer-events-none absolute inset-3 z-[4] grid place-items-center rounded-2xl border-2 border-dashed border-[#b4a6ff] bg-[#8f7cff14] text-[16px] font-semibold text-white">Drop the Excel file to open it</div>}
      <div className="absolute inset-x-0 bottom-6 z-[5] flex flex-col items-center gap-2 px-4">
        {error && (
          <p role="alert" className="max-w-[520px] rounded-lg border bg-[#0d0d14e6] px-3 py-2 text-[13px]" style={{ borderColor: "color-mix(in srgb, var(--declined) 40%, transparent)", color: "var(--declined)" }}>
            {error}
          </p>
        )}
        <label className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0d0d14cc] px-3 py-2 text-[13px] text-ink-2 backdrop-blur">
          What kind of store is this?
          <select value={category} onChange={(e) => onCategory(e.target.value as CategoryId)} aria-label="Type of retail store" className="rounded-md border border-white/10 bg-[#101019] px-2 py-1 text-[13px] text-ink outline-none focus:border-neon">
            {CATEGORY_IDS.map((id) => (
              <option key={id} value={id}>{CATEGORY_PRESETS[id].label}</option>
            ))}
          </select>
          <span className="basis-full text-center text-[11.5px] text-muted">The Excel file does not say, so this sets the costs, sizes and timings every decision uses. Change it any time.</span>
        </label>
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0d0d14cc] p-1.5 shadow-2xl backdrop-blur">
          <label htmlFor="file" className="neon-btn inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-bold">
            <Icon.Upload /> {loading ? "Reading the workbook…" : "Upload your data"}
          </label>
          <a href="/sample/franchise-upload-format.xlsx" download="Franchise-Desk-upload-format.xlsx" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-white/5">
            <Icon.Download /> Download the upload format
          </a>
          <input
            id="file"
            type="file"
            accept=".xlsx,.xlsm,.xls"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </div>
        <button type="button" onClick={() => onSample()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] text-muted hover:bg-white/5 hover:text-ink disabled:opacity-60">
          <Icon.Spark size={13} /> Try sample data
        </button>
      </div>
    </main>
  );
}
