import { bankroll, type Bet, type Pick3, type State } from "./state";

export type MatchResult = Pick3 | "void";

export function settleDelta(bet: Bet, result: MatchResult): number {
  if (result === "void") return 0;
  return bet.pick === result ? bet.stake * (bet.odds - 1) : -bet.stake;
}

export function applySettlement(s: State, bet: Bet, result: MatchResult, t: string, score?: string): void {
  bet.status = result === "void" ? "void" : bet.pick === result ? "won" : "lost";
  bet.settledResult = result;
  if (score) bet.settledScore = score;
  const next = Math.max(0, bankroll(s, bet.model) + settleDelta(bet, result));
  s.series[bet.model].push({ t, bankroll: Math.round(next * 100) / 100 });
}
