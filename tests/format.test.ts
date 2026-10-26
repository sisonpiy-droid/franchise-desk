import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { parseWorkbook } from "@/lib/parse/parse";
import { readWorkbook } from "@/lib/parse/xlsx";
import { TODAY } from "./helpers";

describe("the downloadable upload format", () => {
  it("is the case template and the tool reads it without errors", () => {
    const buf = readFileSync(path.resolve(__dirname, "../public/sample/franchise-upload-format.xlsx"));
    const ds = parseWorkbook(readWorkbook(new Uint8Array(buf)), "franchise-upload-format.xlsx", "upload");
    expect(ds.notes.filter((n) => n.severity === "error")).toHaveLength(0);
    expect(ds.applications.length).toBeGreaterThan(0);
    expect(ds.territories.length).toBeGreaterThan(0);
    expect(ds.stores.length).toBeGreaterThan(0);
    const r = run(ds, DEFAULT_POLICY, { today: TODAY, pinned: {} });
    expect(r.decisions).toHaveLength(ds.applications.length);
  });
});
