"use client";
// Requests whose pincode is in no territory (or in a city with no territory) are not drawn as pins, because a pin reads as a
// place to open. They live here instead: one line above the map, and a list that opens on click.
import { useState } from "react";
import { plainReason } from "@/lib/engine/plain";
import type { Decision } from "@/lib/engine/types";
import { StatusChip } from "./icons";

export function UnassignedBanner({ decisions, onOpen }: { decisions: Decision[]; onOpen: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!decisions.length) return null;
  return (
    <div className="absolute left-1/2 top-3 z-[6] w-[min(560px,calc(100%-24px))] -translate-x-1/2" data-testid="unassigned">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mx-auto flex w-full items-center gap-2.5 rounded-full border border-white/15 bg-[#101019]/92 px-4 py-2 text-left text-[13px] text-ink shadow-xl backdrop-blur hover:border-white/30">
        <span className="grid size-5 shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: "color-mix(in srgb, var(--hold) 25%, transparent)", color: "var(--hold)" }}>!</span>
        <span className="min-w-0 flex-1 truncate"><b className="num">{decisions.length}</b> request{decisions.length === 1 ? " is" : "s are"} outside every territory</span>
        <span className="shrink-0 text-[12px] font-semibold text-neon">{open ? "Hide" : "See them"}</span>
      </button>
      {open && (
        <ul className="scrollbar-thin mt-2 max-h-[46vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0c13]/96 py-1 shadow-2xl backdrop-blur" aria-label="Requests outside every territory">
          {decisions.map((d) => (
            <li key={d.key}>
              <button type="button" onClick={() => onOpen(d.key)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink"><span className="num text-muted">{d.id}</span> {d.name || "No name"}</span>
                  <span className="block truncate text-[12px] text-muted">{plainReason(d)}</span>
                </span>
                <StatusChip status={d.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
