import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { parseWorkbook, ParseError } from "@/lib/parse/parse";
import { readWorkbook } from "@/lib/parse/xlsx";
import { loadXlsx, TODAY } from "./helpers";

const goldenBytes = () => new Uint8Array(readFileSync(path.resolve(__dirname, "golden/golden.xlsx")));
const parse = (bytes: Uint8Array, name = "x.xlsx") => parseWorkbook(readWorkbook(bytes), name, "upload");

/** The golden workbook with one cell edited, written back to bytes. */
function edited(fn: (wb: XLSX.WorkBook) => void): Uint8Array {
  const wb = XLSX.read(goldenBytes(), { type: "array" });
  fn(wb);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

describe("malformed files never crash the app", () => {
  it("random bytes either fail with a readable message or yield no applications", () => {
    const junk = new Uint8Array(2000).map((_, i) => (i * 37) % 251);
    let msg = "";
    try {
      const ds = parse(junk);
      expect(ds.applications).toHaveLength(0);
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    if (msg) expect(msg.length).toBeGreaterThan(5);
  });
  it("an empty file is reported, not thrown as a raw error from the parser", () => {
    expect(() => parse(new Uint8Array(0))).toThrow();
  });
  it("a workbook without the Applications sheet names what is missing", () => {
    const bytes = edited((wb) => {
      const i = wb.SheetNames.findIndex((n) => /application/i.test(n));
      delete wb.Sheets[wb.SheetNames[i]];
      wb.SheetNames.splice(i, 1);
    });
    expect(() => parse(bytes)).toThrow(ParseError);
    expect(() => parse(bytes)).toThrow(/Applications/);
  });
});

describe("store data checks", () => {
  it("a duplicated existing-store ID is warned about, not silently merged", () => {
    const bytes = edited((wb) => {
      const name = wb.SheetNames.find((n) => /store/i.test(n))!;
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
      const hi = rows.findIndex((r) => String(r[0]).trim() === "Store ID");
      const first = rows[hi + 1];
      XLSX.utils.sheet_add_aoa(ws, [[first[0], "Elsewhere", "560099", 2024]], { origin: -1 });
    });
    const ds = parse(bytes);
    const warn = ds.notes.filter((n) => n.sheet === "Existing stores" && n.severity === "warn" && /more than once/.test(n.message));
    expect(warn).toHaveLength(1);
    expect(ds.stores.length).toBeGreaterThan(loadXlsx("golden/golden.xlsx").stores.length);
  });
});

describe("repeat uploads do not mix data", () => {
  it("two workbooks parsed one after another share nothing", () => {
    const a = loadXlsx("golden/golden.xlsx", "upload");
    const b = loadXlsx("golden/stress500.xlsx", "upload");
    const ra = run(a, DEFAULT_POLICY, { today: TODAY, pinned: {} });
    const rb = run(b, DEFAULT_POLICY, { today: TODAY, pinned: {} });
    const ra2 = run(a, DEFAULT_POLICY, { today: TODAY, pinned: {} });
    expect(rb.decisions).toHaveLength(b.applications.length);
    expect(ra.decisions).toHaveLength(a.applications.length);
    expect(JSON.stringify(ra2.decisions)).toBe(JSON.stringify(ra.decisions));
    const idsA = new Set(a.applications.map((x) => x.key));
    expect(rb.decisions.filter((d) => idsA.has(d.key) && !b.applications.some((x) => x.key === d.key))).toHaveLength(0);
  });
});
