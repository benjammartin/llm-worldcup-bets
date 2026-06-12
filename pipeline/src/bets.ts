import { MAX_STAKE_RATIO } from "./config";
import type { MatchOdds } from "./odds";
import { extractBets, type RawBet } from "./parse";
import { buildPrompt } from "./prompt";
import { bankroll, pendingStake, type State } from "./state";

export type LLMFn = (modelId: string, prompt: string) => Promise<string>;
export interface ModelSpec { id: string; name: string; color: string; }

export async function placeBets(
  s: State,
  matches: MatchOdds[],
  models: ModelSpec[],
  llm: LLMFn,
  now: string,
): Promise<void> {
  const byId = new Map(matches.map((m) => [m.matchId, m]));

  for (const model of models) {
    const fresh = matches.filter((m) => !s.bets.some((b) => b.id === `${m.matchId}:${model.name}`));
    if (fresh.length === 0) continue;

    const roll = bankroll(s, model.name);
    const locked = pendingStake(s, model.name);
    const available = Math.max(0, roll - locked);
    const prompt = buildPrompt(model.name, roll, available, s.bets.filter((b) => b.model === model.name), fresh);

    let raw;
    try {
      raw = await attempt(llm, model.id, prompt, 2, fresh.map((m) => m.matchId));
    } catch (e) {
      s.meta.failures.push({ date: now, model: model.name, reason: String(e) });
      continue;
    }

    for (const r of normalizeStakes(raw, available, roll)) {
      const match = byId.get(r.matchId);
      if (!match || s.bets.some((b) => b.id === `${r.matchId}:${model.name}`)) continue;
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

async function attempt(llm: LLMFn, id: string, prompt: string, tries: number, requiredMatchIds: string[]) {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const bets = extractBets(await llm(id, prompt));
      assertAllMatchesBet(bets, requiredMatchIds);
      return bets;
    }
    catch (e) { lastErr = e; }
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

function assertAllMatchesBet(raw: { matchId: string }[], requiredMatchIds: string[]) {
  const got = new Set(raw.map((b) => b.matchId));
  const missing = requiredMatchIds.filter((id) => !got.has(id));
  if (missing.length > 0) throw new Error(`missing bets for matchIds: ${missing.join(", ")}`);
}
