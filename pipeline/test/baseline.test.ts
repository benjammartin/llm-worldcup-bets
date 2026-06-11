import { describe, expect, test } from "bun:test";
import { placeBaselineBets } from "../src/baseline";
import type { MatchOdds } from "../src/odds";
import { initialState } from "../src/state";

const MATCHES: MatchOdds[] = [
  { matchId: "m1", homeTeam: "France", awayTeam: "Spain",
    kickoff: "2026-06-11T16:00:00Z", odds: { home: 1.8, draw: 3.5, away: 4.0 } },
  { matchId: "m2", homeTeam: "Japan", awayTeam: "Brazil",
    kickoff: "2026-06-11T19:00:00Z", odds: { home: 6.0, draw: 4.0, away: 1.5 } },
];

describe("placeBaselineBets", () => {
  test("stakes 10% of bankroll on the lowest-odds outcome of every match", () => {
    const s = initialState(["Baseline"], 10_000, "2026-06-11T08:00:00Z");
    placeBaselineBets(s, MATCHES, "2026-06-11T08:00:00Z");
    expect(s.bets).toHaveLength(2);
    expect(s.bets[0]).toMatchObject({ id: "m1:Baseline", pick: "home", stake: 1_000, odds: 1.8 });
    expect(s.bets[1]).toMatchObject({ id: "m2:Baseline", pick: "away", stake: 1_000, odds: 1.5 });
  });

  test("is idempotent", () => {
    const s = initialState(["Baseline"], 10_000, "2026-06-11T08:00:00Z");
    placeBaselineBets(s, MATCHES, "2026-06-11T08:00:00Z");
    placeBaselineBets(s, MATCHES, "2026-06-11T08:00:00Z");
    expect(s.bets).toHaveLength(2);
  });
});
