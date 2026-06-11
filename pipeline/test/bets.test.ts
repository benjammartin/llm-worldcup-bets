import { describe, expect, test } from "bun:test";
import { placeBets, type LLMFn } from "../src/bets";
import type { MatchOdds } from "../src/odds";
import { initialState } from "../src/state";

const MATCHES: MatchOdds[] = [
  { matchId: "m1", homeTeam: "France", awayTeam: "Spain",
    kickoff: "2026-06-11T16:00:00Z", odds: { home: 1.8, draw: 3.5, away: 4.0 } },
  { matchId: "m2", homeTeam: "Brazil", awayTeam: "Japan",
    kickoff: "2026-06-11T19:00:00Z", odds: { home: 1.5, draw: 4.0, away: 6.0 } },
];
const MODELS = [{ id: "test/model-a", name: "ModelA", color: "#fff" }];
const NOW = "2026-06-11T08:00:00Z";

describe("placeBets", () => {
  test("records parsed bets with odds from the picked side, clamped to 25%", async () => {
    const llm: LLMFn = async () =>
      `[{"matchId":"m1","pick":"home","stake":9000,"reasoning":"allez"},
        {"matchId":"m2","pick":"away","stake":1000,"reasoning":"upset"}]`;
    const s = initialState(["ModelA"], 10_000, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    expect(s.bets).toHaveLength(2);
    expect(s.bets[0]).toMatchObject({
      id: "m1:ModelA", pick: "home", stake: 2_500, odds: 1.8, status: "pending",
    }); // 9000 clamped to 25% of 10k
    expect(s.bets[1]).toMatchObject({ id: "m2:ModelA", odds: 6.0, stake: 1_000 });
  });

  test("is idempotent: re-running the same day adds nothing", async () => {
    const llm: LLMFn = async () =>
      `[{"matchId":"m1","pick":"home","stake":100,"reasoning":"x"}]`;
    const s = initialState(["ModelA"], 10_000, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    expect(s.bets).toHaveLength(1);
  });

  test("ignores bets on unknown matchIds", async () => {
    const llm: LLMFn = async () =>
      `[{"matchId":"hallucinated","pick":"home","stake":100,"reasoning":"x"}]`;
    const s = initialState(["ModelA"], 10_000, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    expect(s.bets).toHaveLength(0);
  });

  test("retries once on garbage, then records a failure and moves on", async () => {
    let calls = 0;
    const llm: LLMFn = async () => { calls++; return "I refuse."; };
    const s = initialState(["ModelA"], 10_000, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    expect(calls).toBe(2);
    expect(s.bets).toHaveLength(0);
    expect(s.meta.failures).toHaveLength(1);
    expect(s.meta.failures[0].model).toBe("ModelA");
  });

  test("clamps total stakes to available bankroll minus pending", async () => {
    const llm: LLMFn = async () =>
      `[{"matchId":"m1","pick":"home","stake":2500,"reasoning":"a"},
        {"matchId":"m2","pick":"home","stake":2500,"reasoning":"b"}]`;
    const s = initialState(["ModelA"], 3_000, NOW); // 25% cap = 750 each
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    expect(s.bets.map((b) => b.stake)).toEqual([750, 750]);
  });
});
