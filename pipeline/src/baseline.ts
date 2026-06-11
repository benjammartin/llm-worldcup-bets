import { BASELINE_NAME, BASELINE_STAKE_RATIO } from "./config";
import type { MatchOdds } from "./odds";
import { bankroll, type Pick3, type State } from "./state";

export function placeBaselineBets(s: State, matches: MatchOdds[], now: string): void {
  for (const m of matches) {
    const id = `${m.matchId}:${BASELINE_NAME}`;
    if (s.bets.some((b) => b.id === id)) continue;
    const pick = (Object.entries(m.odds) as [Pick3, number][])
      .sort((a, b) => a[1] - b[1])[0][0];
    const stake = Math.round(bankroll(s, BASELINE_NAME) * BASELINE_STAKE_RATIO * 100) / 100;
    s.bets.push({
      id, date: now, matchId: m.matchId,
      match: `${m.homeTeam} vs ${m.awayTeam}`,
      homeTeam: m.homeTeam, awayTeam: m.awayTeam, kickoff: m.kickoff,
      model: BASELINE_NAME, pick, stake, odds: m.odds[pick],
      reasoning: "Always bet the favorite.", status: "pending",
    });
  }
}
