import { MAX_STAKE_RATIO } from "./config";
import type { MatchOdds } from "./odds";
import { extractBets, type RawBet } from "./parse";
import { buildPrompt } from "./prompt";
import { bankroll, type State } from "./state";

export type LLMFn = (modelId: string, prompt: string) => Promise<string>;
export interface ModelSpec { id: string; fallbackIds?: string[]; name: string; color: string; }

export async function placeBets(
  s: State,
  matches: MatchOdds[],
  models: ModelSpec[],
  llm: LLMFn,
  now: string,
  fifaReportContext = "",
): Promise<void> {
  const byId = new Map(matches.map((m) => [m.matchId, m]));

  for (const model of models) {
    const editable = matches.filter((m) => canPlaceOrReplace(s, model.name, m.matchId, m.kickoff, now));
    if (editable.length === 0) continue;

    const editableIds = new Set(editable.map((m) => m.matchId));
    const roll = bankroll(s, model.name);
    const locked = lockedPendingStake(s, model.name, editableIds);
    const available = Math.max(0, roll - locked);
    const prompt = buildPrompt(model.name, roll, available, s.bets.filter((b) => b.model === model.name), editable, fifaReportContext);

    let raw;
    try {
      raw = await attempt(llm, [model.id, ...(model.fallbackIds ?? [])], prompt, 2, editable.map((m) => m.matchId));
    } catch (e) {
      s.meta.failures.push({ date: now, model: model.name, reason: String(e) });
      continue;
    }

    s.bets = s.bets.filter((b) => !(b.model === model.name && editableIds.has(b.matchId) && b.status === "pending"));

    for (const r of normalizeStakes(raw, available, roll)) {
      const match = byId.get(r.matchId);
      if (!match || !editableIds.has(r.matchId)) continue;
      const stake = r.stake;
      if (stake <= 0) continue;
      s.bets.push({
        id: `${match.matchId}:${model.name}`, date: now,
        matchId: match.matchId, match: `${match.homeTeam} vs ${match.awayTeam}`,
        homeTeam: match.homeTeam, awayTeam: match.awayTeam, kickoff: match.kickoff,
        model: model.name, pick: r.pick, stake, odds: match.odds[r.pick],
        reasoning: r.reasoning, status: "pending",
      });
    }
  }
  s.meta.lastBetsRun = now;
}

async function attempt(llm: LLMFn, ids: string[], prompt: string, tries: number, requiredMatchIds: string[]) {
  let lastErr: unknown;
  for (const id of ids) {
    for (let i = 0; i < tries; i++) {
      try {
        const bets = extractBets(await llm(id, prompt));
        assertAllMatchesBet(bets, requiredMatchIds);
        return bets;
      }
      catch (e) { lastErr = e; }
    }
  }
  throw lastErr;
}

function normalizeStakes(raw: RawBet[], availableCash: number, roll: number): RawBet[] {
  const maxPerBet = Math.max(0, roll * MAX_STAKE_RATIO);
  const capped = raw.map((b) => ({ ...b, stake: Math.min(b.stake, maxPerBet) }));
  const total = capped.reduce((sum, b) => sum + b.stake, 0);
  if (total <= availableCash) return capped.map((b) => ({ ...b, stake: roundCents(b.stake) }));
  const factor = availableCash / total;
  return capped.map((b) => ({ ...b, stake: roundCents(b.stake * factor) }));
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function canPlaceOrReplace(s: State, model: string, matchId: string, kickoff: string, now: string): boolean {
  if (Date.parse(kickoff) <= Date.parse(now)) return false;
  const existing = s.bets.find((b) => b.id === `${matchId}:${model}`);
  return !existing || existing.status === "pending";
}

function lockedPendingStake(s: State, model: string, editableIds: Set<string>): number {
  return s.bets
    .filter((b) => b.model === model && b.status === "pending" && !editableIds.has(b.matchId))
    .reduce((sum, b) => sum + b.stake, 0);
}

function assertAllMatchesBet(raw: { matchId: string }[], requiredMatchIds: string[]) {
  const got = new Set(raw.map((b) => b.matchId));
  const missing = requiredMatchIds.filter((id) => !got.has(id));
  if (missing.length > 0) throw new Error(`missing bets for matchIds: ${missing.join(", ")}`);
}
