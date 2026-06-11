import { describe, expect, test } from "bun:test";
import { composeUpdate } from "../src/post";
import { initialState, type Bet } from "../src/state";

describe("composeUpdate", () => {
  test("summarizes settled match and top 3 standings within 280 chars", () => {
    const s = initialState(["Claude", "GPT-5", "Grok", "Baseline"], 10_000, "2026-06-11T08:00:00Z");
    s.series["Claude"].push({ t: "x", bankroll: 11_850 });
    s.series["Grok"].push({ t: "x", bankroll: 8_000 });
    const settled: Bet[] = [
      { id: "m1:Claude", date: "d", matchId: "m1", match: "France vs Spain",
        homeTeam: "France", awayTeam: "Spain", kickoff: "k", model: "Claude",
        pick: "home", stake: 1_000, odds: 1.85, reasoning: "", status: "won" },
      { id: "m1:Grok", date: "d", matchId: "m1", match: "France vs Spain",
        homeTeam: "France", awayTeam: "Spain", kickoff: "k", model: "Grok",
        pick: "away", stake: 2_000, odds: 4.0, reasoning: "", status: "lost" },
    ];
    const text = composeUpdate(s, "France vs Spain", "2-0", settled, "https://example.com");
    expect(text).toContain("France vs Spain (2-0)");
    expect(text).toContain("Claude +$850");
    expect(text).toContain("Grok -$2,000");
    expect(text).toContain("1. Claude $11,850");
    expect(text.length).toBeLessThanOrEqual(280);
  });
});
