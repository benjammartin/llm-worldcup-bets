import { MAX_STAKE_RATIO } from "./config";
import type { MatchOdds } from "./odds";
import type { Bet } from "./state";

export function buildPrompt(
  modelName: string,
  bankroll: number,
  availableCash: number,
  history: Bet[],
  matches: MatchOdds[],
): string {
  const settled = history.filter((b) => b.status === "won" || b.status === "lost");
  const won = settled.filter((b) => b.status === "won").length;
  const recent = settled.slice(-5)
    .map((b) => `${b.match}: ${b.pick} $${b.stake} @${b.odds} → ${b.status}`)
    .join("\n") || "none yet";
  const lines = matches
    .map((m) => `- id "${m.matchId}": ${m.homeTeam} vs ${m.awayTeam} — home ${m.odds.home}, draw ${m.odds.draw}, away ${m.odds.away}`)
    .join("\n");

  const maxStake = Math.max(0, bankroll * MAX_STAKE_RATIO);

  return `You are ${modelName}, an AI competing against 5 other AIs in a public World Cup 2026 betting game. Everyone started with $10,000. Highest bankroll at the end of the tournament wins.

Your bankroll: $${bankroll.toFixed(2)}
Available cash for new bets: $${availableCash.toFixed(2)}
Maximum stake per individual match: $${maxStake.toFixed(2)}
Your record: ${won} won / ${settled.length - won} lost. Last results:
${recent}

Upcoming matches with available odds:
${lines}

Place your bets. Rules:
- You MUST place exactly one bet for every listed match. Do not skip matches.
- You decide the stake for each match. Allocate your available cash across the listed matches however you want; higher stake means higher confidence.
- No individual match stake may exceed 25% of your current bankroll. If you ask for more, the system will cap that bet at the per-match maximum.
- Stakes are in dollars. If your total new stake exceeds your available cash after the per-match cap, the system will scale your stakes down proportionally while preserving your relative conviction.
- Your reasoning will be published VERBATIM on a public website next to your name. Be yourself.

Reply with ONLY a JSON array, no other text:
[{"matchId": "...", "pick": "home"|"draw"|"away", "stake": 500, "reasoning": "..."}]`;
}
