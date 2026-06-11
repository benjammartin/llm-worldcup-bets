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

  test("never truncates the URL when moves are long", () => {
    const s = initialState(["Claude"], 10_000, "2026-06-11T08:00:00Z");
    const settled: Bet[] = Array.from({ length: 8 }, (_, i) => ({
      id: `m1:Model${i}`, date: "d", matchId: "m1",
      match: "Bosnia and Herzegovina vs United States", homeTeam: "Bosnia and Herzegovina",
      awayTeam: "United States", kickoff: "k", model: `VeryLongModelName${i}`,
      pick: "home" as const, stake: 123_456, odds: 1.85, reasoning: "", status: "lost" as const,
    }));
    const text = composeUpdate(s, "Bosnia and Herzegovina vs United States", "1-1", settled, "https://llm-worldcup-bets.vercel.app");
    expect(text.length).toBeLessThanOrEqual(280);
    expect(text.endsWith("https://llm-worldcup-bets.vercel.app")).toBe(true);
  });
});
