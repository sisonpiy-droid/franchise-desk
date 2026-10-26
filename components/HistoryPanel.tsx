"use client";
// Upload history: every workbook uploaded on this browser, newest first, with its date and time. Reopen one, delete one, or clear all.
// Kept in this browser only; nothing is sent to a server.
import { useCallback, useEffect, useState } from "react";
import { clearHistory, deleteUpload, listUploads, type UploadRecord } from "@/lib/history";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

export function HistoryPanel({ onOpen, refreshKey }: { onOpen: (id: string, name: string) => void; refreshKey?: number }) {
  const [rows, setRows] = useState<UploadRecord[] | null>(null);
  const load = useCallback(() => { listUploads().then(setRows); }, []);
  useEffect(load, [load, refreshKey]);
  return (
    <div className="text-[13.5px] text-ink-2" data-testid="history">
      <p>Every workbook you upload is saved here with its date and time, <b className="text-ink">in this browser only</b>. Nothing is sent to a server. Reopen an earlier upload, or delete it.</p>
      <p className="mt-2 text-[12.5px] text-muted">The first time an application (same ID and name) appears in any upload becomes its <b>first-seen date</b>. The workbook has no submission dates, so this date decides who came first.</p>
      {rows === null && <p className="mt-6 text-muted">Loading…</p>}
      {rows && !rows.length && <p className="mt-6 rounded-lg border border-line px-4 py-6 text-center text-muted">No uploads yet. Upload a workbook and it will appear here.</p>}
      {rows && rows.length > 0 && (
        <>
          <ul className="mt-4 grid gap-2">
            {rows.map((r, i) => (
              <li key={r.id} className="rounded-lg border border-line px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{r.name}</span>
                  {i === 0 && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--neon-soft)", color: "var(--neon)" }}>Latest</span>}
                  <span className="num ml-auto text-[12.5px] text-muted">{when(r.at)}</span>
                </div>
                <div className="num mt-1 text-[12.5px] text-muted">{r.apps} applications · {r.territories} territories · {r.stores} existing stores · {kb(r.size)}</div>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => onOpen(r.id, r.name)} className="neon-btn rounded-full px-3.5 py-1 text-[12.5px] font-semibold">Open this upload</button>
                  <button type="button" onClick={() => deleteUpload(r.id).then(load)} className="rounded-full border border-line px-3 py-1 text-[12.5px] hover:bg-surface-2">Delete</button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => { if (window.confirm("Delete every saved upload and every first-seen date from this browser?")) clearHistory().then(load); }} className="mt-4 text-[12.5px] text-muted underline decoration-dotted underline-offset-2 hover:text-ink">Clear all history</button>
        </>
      )}
    </div>
  );
}
