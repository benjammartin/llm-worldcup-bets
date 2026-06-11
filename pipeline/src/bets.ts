import { MAX_STAKE_RATIO } from "./config";
import type { MatchOdds } from "./odds";
import { extractBets } from "./parse";
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
    const prompt = buildPrompt(model.name, roll, s.bets.filter((b) => b.model === model.name), fresh);

    let raw;
    try {
      raw = await attempt(llm, model.id, prompt, 2);
    } catch (e) {
      s.meta.failures.push({ date: now, model: model.name, reason: String(e) });
      continue;
    }

    let available = roll - pendingStake(s, model.name);
    for (const r of raw) {
      const match = byId.get(r.matchId);
      if (!match || s.bets.some((b) => b.id === `${r.matchId}:${model.name}`)) continue;
      const stake = Math.round(Math.min(r.stake, roll * MAX_STAKE_RATIO, available) * 100) / 100;
      if (stake <= 0) continue;
      available -= stake;
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

async function attempt(llm: LLMFn, id: string, prompt: string, tries: number) {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try { return extractBets(await llm(id, prompt)); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}
