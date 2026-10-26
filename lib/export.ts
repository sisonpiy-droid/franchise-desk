// Excel export with formula-injection sanitising. Runs in the browser.
import * as XLSX from "xlsx";
import { CODE_LABEL } from "./engine/codes";
import { statusWord } from "./engine/counterfactual";
import type { LogEntry } from "./engine/session";
import type { Dataset, RunResult } from "./engine/types";
import reference from "./engine/reference.json";

/** Prefix cells that a spreadsheet would treat as a formula. */
export function sanitiseCell(v: unknown): unknown {
  if (typeof v !== "string") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const clean = (rows: unknown[][]) => rows.map((r) => r.map(sanitiseCell));
// a number written as text (for example "-10") is data, not a formula: keep it exactly so the file re-imports unchanged
const NUMERIC = /^[-+]?\d+(\.?\d+)?$/;
const cleanInput = (rows: unknown[][]) => rows.map((r) => r.map((v) => (typeof v === "string" && NUMERIC.test(v) ? v : sanitiseCell(v))));

const SPACE_WORD = { None: "Not yet identified", Owned: "Owned", Rented: "Rented" } as const;
const FLOOR_WORD = { Ground: "Ground", Mall: "Mall unit", Upper: "Upper", Unknown: "Not known" } as const;

/**
 * The same three sheets (plus Allowed values) the tool reads on upload, in the same layout, holding the CURRENT data:
 * every update made in the desk is already in these rows. Upload the exported file and you get the same file back.
 */
export function inputSheets(ds: Dataset): { name: string; rows: unknown[][] }[] {
  const apps: unknown[][] = [
    ["Applications — one row per record. Exported from Franchise Desk with every update applied; upload it again to continue."],
    ["Application ID", "Applicant name", "City", "State", "Pin code", "Investment capacity (₹ lakh)", "Retail experience (years)", "Current / past business", "Space available", "Space size (sq ft)", "Floor", "Target launch (months)", "Preferred language", "Notes from applicant"],
    ...ds.applications.map((a) => [
      a.id,
      a.name,
      a.city ?? "",
      a.state ?? "",
      a.pin ?? a.pinRaw ?? "",
      a.invest ?? a.investRaw ?? "",
      a.experience ?? "",
      a.business ?? "",
      a.space ? SPACE_WORD[a.space] : a.spaceRaw ?? "",
      a.size ?? a.sizeRaw ?? "",
      a.floor ? FLOOR_WORD[a.floor] : a.floorRaw ?? "",
      a.targetMonths ?? a.targetRaw ?? "",
      a.language ?? "",
      a.notes ?? "",
    ]),
  ];
  const ters: unknown[][] = [
    ["Territories — one row per record."],
    ["Territory ID", "City", "State", "Pin codes covered", "City tier", "Open slots", "Priority"],
    ...ds.territories.map((t) => [t.id, t.city ?? "", t.state ?? "", t.pins.join(", "), t.tier ? `Tier ${t.tier}` : "", t.slots ?? "", t.priority ?? ""]),
  ];
  const stores: unknown[][] = [
    ["FIXED - all the brand's stores open today."],
    ["Store ID", "City", "Pin code", "Opened (year)"],
    ...ds.stores.map((x) => [x.id, x.city, x.pin, x.year ?? ""]),
  ];
  const cities = ds.cities ?? reference.cities;
  const allowed: unknown[][] = [
    ["Allowed values - test data will only use these"],
    [],
    ["City", "State", "Pin codes start with", "City tier"],
    ...cities.map((c) => [c.city, c.state ?? "", c.prefix, `Tier ${c.tier}`]),
    [],
    ["Preferred language", "Kannada, English, Hindi"],
  ];
  return [
    { name: "Applications", rows: cleanInput(apps) },
    { name: "Territories", rows: cleanInput(ters) },
    { name: "Existing stores", rows: cleanInput(stores) },
    { name: "Allowed values", rows: cleanInput(allowed) },
  ];
}

export function buildExport(ds: Dataset, r: RunResult, log: LogEntry[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  // first: the four input sheets, so the file can be uploaded again as it is
  for (const sh of inputSheets(ds)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh.rows), sh.name);
  const banner = ds.source === "sample" ? [["SAMPLE DATA, not real applicants"]] : [[`Source: ${ds.fileName}`]];
  const meta = [[`Run ${r.runId} · policy ${r.policyVersion} · as of ${r.asOf}`], []];

  const decisions = [
    ["Application ID", "Applicant", "Territory", "Pin", "Status", "Why", "Next step", "Owner", "Score", "Rank", "Queue", "Reasons"],
    ...r.decisions.map((d) => [d.id, d.name, d.territoryId ?? "", d.pin ?? "", statusWord(d.status), d.why, d.nextStep, d.owner, d.score?.total ?? "", d.rank ? `${d.rank.k} of ${d.rank.n}` : "", d.queuePos ?? "", d.codes.map((c) => CODE_LABEL[c]).join("; ")]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clean([...banner, ...meta, ...decisions])), "Decisions");

  const plans: unknown[][] = [["Application ID", "Week", "Weeks", "Step", "Owner", "Ready by", "Target", "Training", "Buddy store", "Hub", "Payback (months, illustrative)"]];
  for (const d of r.decisions)
    if (d.plan)
      for (const s of d.plan.steps)
        plans.push([d.id, s.week, s.weeks, s.label, s.owner, d.plan.readyDate, d.plan.targetDate ?? "", `${d.plan.training.track} ${d.plan.training.weeks} wk, ${d.plan.training.language}`, d.plan.training.buddyStore ?? "", d.plan.supply.hub, d.plan.payback.months ?? "n/a"]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clean([...banner, ...meta, ...plans])), "Plans");

  const ters = [
    ["Territory", "City", "Tier", "Priority", "Open slots", "Free pins", "Usable capacity", "Approved", "Conditional", "Waitlisted", "On hold", "Note"],
    ...r.territories.map((t) => [t.id, t.city ?? "", t.tier ?? "", t.priority ?? "", t.slots, t.freePins.join(", "), t.effectiveCapacity, t.approved.join(", "), t.conditional.join(", "), t.waitlisted.join(", "), t.onHold.join(", "), t.bindingReason ?? ""]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clean([...banner, ...meta, ...ters])), "Territory summary");

  const notes = [["Sheet", "Row", "Note"], ...ds.notes.map((n) => [n.sheet, n.row ?? "", n.message]), ...ds.rowsIgnored.map((i) => [i.sheet, i.row, `Ignored: ${i.reason}`])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clean([...banner, ...notes])), "Data notes");

  const audit = [["When", "Update"], ...log.map((l) => [l.at, l.update.text])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clean([...banner, ...audit])), "Audit log");
  const about = [
    ["About this file"],
    [""],
    ["Sheets 1 to 4 (Applications, Territories, Existing stores, Allowed values) are in the same format you uploaded and hold the current data, including every update made in the desk. Upload this file again to continue."],
    ["The sheets after them (Decisions, Plans, Territory summary, Data notes, Audit log) are results for reading. The tool ignores them on upload."],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(about), "About this file");
  return wb;
}

export function downloadExport(ds: Dataset, r: RunResult, log: LogEntry[]) {
  const wb = buildExport(ds, r, log);
  XLSX.writeFile(wb, `franchise-decisions-${r.runId}.xlsx`, { compression: true });
}
