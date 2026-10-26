import { describe, expect, it } from "vitest";
import { run, DEFAULT_POLICY } from "@/lib/engine";
import { selfTest } from "@/lib/engine/selftest";
import { controlTower } from "@/lib/engine/tower";
import { loadXlsx, TODAY } from "./helpers";

const ds = loadXlsx("golden/golden.xlsx");

describe("integrity self-test", () => {
  it("passes every check on the golden file", () => {
    const checks = selfTest(ds, DEFAULT_POLICY, { today: TODAY, pinned: {} });
    expect(checks).toHaveLength(5);
    for (const c of checks) expect(c.pass, `${c.name}: ${c.detail}`).toBe(true);
  });
  it("passes on the red-team file too", () => {
    const rt = loadXlsx("redteam/redteam.xlsx", "upload");
    for (const c of selfTest(rt, DEFAULT_POLICY, { today: TODAY, pinned: {} })) expect(c.pass, `${c.name}: ${c.detail}`).toBe(true);
  });
});

describe("control tower", () => {
  const r = run(ds, DEFAULT_POLICY, { today: TODAY, pinned: {} });
  const t = controlTower(r, DEFAULT_POLICY, TODAY);
  it("funnel and openings reflect the decisions", () => {
    expect(t.funnel[0].n).toBe(22);
    expect(t.funnel.find((f) => f.label === "Approved")!.n).toBe(5);
    const ids = t.openings.flatMap((o) => o.ids);
    expect(ids).toEqual(expect.arrayContaining(["APP-001", "APP-010", "APP-018"]));
  });
  it("call-first list leads with live windows, not settled approvals", () => {
    expect(t.calls.length).toBeGreaterThan(0);
    for (const c of t.calls) expect(r.decisions.find((d) => d.key === c.key)!.status).not.toBe("DECLINED");
  });
  it("capacity plan sums partner capital", () => {
    expect(t.capacity.committedLakh).toBeGreaterThan(100);
  });
  it("cost of waiting prices only usable slots nobody holds, from partner economics", () => {
    const open = r.territories.reduce((n, x) => n + x.unusedCapacity, 0);
    expect(t.delay.openSlots).toBe(open);
    if (open === 0) expect(t.delay.lostPerMonthLakh).toBe(0);
    else {
      expect(t.delay.perSlotMonthlyLakh).toBeGreaterThan(0);
      expect(t.delay.lostPerMonthLakh).toBeCloseTo(open * t.delay.perSlotMonthlyLakh!, 0);
      expect(t.delay.lostPerWeekLakh!).toBeLessThan(t.delay.lostPerMonthLakh!);
    }
  });
  it("cost of waiting also prices pending checks and blocked slots without double counting open ones", () => {
    const conditional = r.decisions.filter((d) => d.status === "CONDITIONAL").length;
    expect(t.delay.pendingPartners).toBe(conditional);
    const blocked = r.territories.reduce((n, x) => n + Math.max(0, x.slots - x.effectiveCapacity), 0);
    expect(t.delay.blockedSlots).toBe(blocked);
    if (conditional) expect(t.delay.pendingPerMonthLakh).toBeGreaterThan(0);
  });
  it("pipeline sizing never asks for applicants a territory does not need", () => {
    expect(t.pipeline.received).toBeGreaterThan(0);
    expect(t.pipeline.rate).toBeGreaterThan(0);
    for (const row of t.pipeline.rows) {
      expect(row.open).toBeGreaterThan(0);
      expect(row.fromHolds).toBeLessThanOrEqual(row.open);
      expect(row.sourceApplicants).toBeGreaterThanOrEqual(0);
      if (row.stillNeeded === 0) expect(row.sourceApplicants).toBe(0);
    }
    expect(t.pipeline.totalSource).toBe(t.pipeline.rows.reduce((n, x) => n + x.sourceApplicants, 0));
  });
  it("a file with nobody moving forward has no cost-of-waiting figure and still sizes the pipeline", () => {
    const empty = { ...ds, applications: ds.applications.map((a) => ({ ...a, invest: 1 })) };
    const r2 = run(empty, DEFAULT_POLICY, { today: TODAY, pinned: {} });
    const t2 = controlTower(r2, DEFAULT_POLICY, TODAY);
    expect(t2.delay.lostPerMonthLakh).toBeNull();
    expect(t2.pipeline.rate).toBeGreaterThanOrEqual(0.1);
  });
});
