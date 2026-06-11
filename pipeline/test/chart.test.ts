import { describe, expect, test } from "bun:test";
import { chartSVG } from "../src/chart";
import { renderPNG } from "../src/og";
import { initialState } from "../src/state";
import { FONT_PATH } from "../src/config";

function demoState() {
  const s = initialState(["Claude", "GPT-5", "Baseline"], 10_000, "2026-06-11T08:00:00Z");
  s.series["Claude"].push({ t: "2026-06-12T00:00:00Z", bankroll: 12_400 });
  s.series["GPT-5"].push({ t: "2026-06-12T00:00:00Z", bankroll: 7_100 });
  s.series["Baseline"].push({ t: "2026-06-12T00:00:00Z", bankroll: 10_300 });
  return s;
}

describe("chartSVG", () => {
  test("renders one polyline per competitor plus labels sorted by bankroll", () => {
    const svg = chartSVG(demoState(), 1200, 630);
    expect(svg).toStartWith("<svg");
    expect(svg.match(/<polyline/g)).toHaveLength(3);
    expect(svg).toContain("$12,400");
    expect(svg).toContain("Claude");
    // leader appears before loser in the label list
    expect(svg.indexOf("Claude")).toBeLessThan(svg.indexOf("GPT-5"));
  });

  test("has a viewBox so browsers scale it proportionally", () => {
    expect(chartSVG(demoState(), 1200, 630)).toContain('viewBox="0 0 1200 630"');
  });

  test("single-point series still draw a visible flat line", () => {
    const s = initialState(["Claude"], 10_000, "2026-06-11T08:00:00Z");
    const svg = chartSVG(s, 1200, 630);
    const pts = svg.match(/<polyline points="([^"]+)"/)?.[1] ?? "";
    expect(pts.split(" ").length).toBeGreaterThanOrEqual(2);
  });

  test("baseline is dashed", () => {
    expect(chartSVG(demoState(), 1200, 630)).toContain("stroke-dasharray");
  });
});

describe("renderPNG", () => {
  test("produces a PNG buffer", () => {
    const png = renderPNG(chartSVG(demoState(), 1200, 630), FONT_PATH);
    expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47])); // \x89PNG
  });
});
