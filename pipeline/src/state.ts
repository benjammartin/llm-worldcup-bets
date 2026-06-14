import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PROMPT_VERSION, STARTING_BANKROLL } from "./config";
import type { MatchOdds } from "./odds";

export type Pick3 = "home" | "draw" | "away";
export type BetStatus = "pending" | "won" | "lost" | "void";

export interface Bet {
  id: string;        // `${matchId}:${model}` — idempotence key
  date: string;      // ISO timestamp of placement
  matchId: string;   // the-odds-api event id
  match: string;     // "France vs Spain"
  homeTeam: string;
  awayTeam: string;
  kickoff: string;   // ISO
  model: string;     // display name ("Claude", …, "Baseline")
  pick: Pick3;
  stake: number;     // dollars
  odds: number;      // decimal odds for the pick
  reasoning: string; // published verbatim
  status: BetStatus;
  settledResult?: Pick3 | "void";
  settledScore?: string;
}

export interface SeriesPoint { t: string; bankroll: number; }
export interface UpcomingMatch { matchId: string; homeTeam: string; awayTeam: string; kickoff: string; }

export interface State {
  series: Record<string, SeriesPoint[]>;
  bets: Bet[];
  meta: {
    promptVersion: number;
    lastBetsRun: string | null;
    lastSettleRun: string | null;
    lastCyclePostKey?: string | null;
    upcomingMatches?: UpcomingMatch[];
    failures: { date: string; model: string; reason: string }[];
  };
}

export function initialState(names: string[], start: number, t: string): State {
  return {
    series: Object.fromEntries(names.map((n) => [n, [{ t, bankroll: start }]])),
    bets: [],
    meta: { promptVersion: PROMPT_VERSION, lastBetsRun: null, lastSettleRun: null, lastCyclePostKey: null, failures: [] },
  };
}

export function loadState(path: string, names: string[], t: string): State {
  if (!existsSync(path)) return initialState(names, STARTING_BANKROLL, t);
  return JSON.parse(readFileSync(path, "utf8")) as State;
}

export function saveState(path: string, s: State): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(s, null, 2) + "\n");
}

export function rememberUpcomingMatches(s: State, matches: MatchOdds[], now: string): void {
  const nowMs = Date.parse(now);
  s.meta.upcomingMatches = matches
    .filter((m) => Date.parse(m.kickoff) > nowMs)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .map((m) => ({
      matchId: m.matchId,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      kickoff: m.kickoff,
    }));
}

export function bankroll(s: State, model: string): number {
  const pts = s.series[model];
  return pts[pts.length - 1].bankroll;
}

export function pendingStake(s: State, model: string): number {
  return s.bets
    .filter((b) => b.model === model && b.status === "pending")
    .reduce((sum, b) => sum + b.stake, 0);
}
