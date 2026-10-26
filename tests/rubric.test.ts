import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RubricPanel } from "@/components/RubricPanel";
import { DEFAULT_POLICY, setPolicyValue } from "@/lib/engine/policy";

const text = (policy: typeof DEFAULT_POLICY) => renderToStaticMarkup(createElement(RubricPanel, { policy })).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("rubric summary page", () => {
  it("states the live numbers: bars, point maxima, estimate formula, the AI rule", () => {
    const t = text(DEFAULT_POLICY);
    expect(t).toContain("score out of 100");
    expect(t).toContain("One store per pin");
    for (const n of [String(DEFAULT_POLICY.bars.approval), String(DEFAULT_POLICY.bars.decline), "Funds vs estimate", "Space readiness", "Location"]) expect(t).toContain(n);
    expect(t).toMatch(/Estimated cost = /);
    expect(t).toMatch(/AI never decides anything/);
  });
  it("follows the Policy: change the approval bar and the page changes", () => {
    const t = text(setPolicyValue(DEFAULT_POLICY, "bars.approval", 61));
    expect(t).toContain("61");
    expect(t).toContain("56"); // High priority bar = 61 - 5
  });
  it("the point areas add up to the total it states", () => {
    const s = DEFAULT_POLICY.score;
    expect(s.capital.max + s.experience.max + s.space.max + s.timeline.max + s.territory.max).toBe(100);
  });
});
