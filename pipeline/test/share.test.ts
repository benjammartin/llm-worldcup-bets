import { describe, expect, test } from "bun:test";
import { composeCycleShare, composeMatchShare } from "../src/share";
import type { Bet } from "../src/state";

const bet = (overrides: Partial<Bet>): Bet => ({
  id: "m1:Claude", date: "d", matchId: "m1", match: "Brazil vs Morocco",
  homeTeam: "Brazil", awayTeam: "Morocco", kickoff: "2026-06-13T22:00:00Z",
  model: "Claude", pick: "home", stake: 1_000, odds: 1.7, reasoning: "", status: "pending",
  ...overrides,
});

describe("share copy", () => {
  test("composes a per-match share card with consensus, exposure, and most reckless", () => {
    const bets = [
      bet({ model: "Claude", stake: 2_000 }),
      bet({ id: "m1:Grok", model: "Grok", stake: 3_295 }),
      bet({ id: "m1:Gemini", model: "Gemini", stake: 1_500 }),
    ];
    const text = composeMatchShare(bets, "https://llmworldcup.xyz");
    expect(text).toContain("Brazil vs Morocco");
    expect(text).toContain("3/3 AIs picked Brazil.");
    expect(text).toContain("Total exposed: $6,795.");
    expect(text).toContain("Most reckless: Grok, $3,295.");
    expect(text).toContain("Consensus or collective hallucination?");
  });

  test("composes the short cycle post sorted by kickoff", () => {
    const text = composeCycleShare([
      bet({ matchId: "late", id: "late:Grok", match: "Australia vs Turkey", homeTeam: "Australia", awayTeam: "Turkey", kickoff: "2026-06-14T04:00:00Z", model: "Grok", pick: "away", stake: 4_000 }),
      bet({ matchId: "early", id: "early:Grok", match: "Haiti vs Scotland", homeTeam: "Haiti", awayTeam: "Scotland", kickoff: "2026-06-14T01:00:00Z", model: "Grok", pick: "away", stake: 4_000 }),
    ], "https://llmworldcup.xyz");
    expect(text).toStartWith("Today’s AI World Cup bets:");
    expect(text.indexOf("Haiti v Scotland")).toBeLessThan(text.indexOf("Australia v Turkey"));
    expect(text).toContain("1/1 picked Scotland");
    expect(text).toContain("Biggest: Grok $4,000");
    expect(text).toContain("🇦🇺 Australia v Turkey 🇹🇷");
    expect(composeCycleShare([
      bet({ matchId: "early", id: "early:Grok", match: "Haiti vs Scotland", homeTeam: "Haiti", awayTeam: "Scotland", kickoff: "2026-06-14T01:00:00Z", model: "Grok", pick: "away", stake: 4_000 }),
    ])).not.toContain("http");
  });
});
