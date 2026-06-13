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
  test("records parsed bets with odds from the picked side and caps each LLM-chosen stake at 25% of bankroll", async () => {
    const llm: LLMFn = async () =>
      `[{"matchId":"m1","pick":"home","stake":9000,"reasoning":"allez"},
        {"matchId":"m2","pick":"away","stake":1000,"reasoning":"upset"}]`;
    const s = initialState(["ModelA"], 10_000, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    expect(s.bets).toHaveLength(2);
    expect(s.bets[0]).toMatchObject({
      id: "m1:ModelA", pick: "home", stake: 2_500, odds: 1.8, status: "pending",
    });
    expect(s.bets[1]).toMatchObject({ id: "m2:ModelA", odds: 6.0, stake: 1_000 });
  });

  test("is idempotent: re-running the same day adds nothing", async () => {
    const llm: LLMFn = async () =>
      `[{"matchId":"m1","pick":"home","stake":100,"reasoning":"x"},
        {"matchId":"m2","pick":"away","stake":200,"reasoning":"y"}]`;
    const s = initialState(["ModelA"], 10_000, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    expect(s.bets).toHaveLength(2);
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

  test("falls back to alternate model ids when the primary provider id is unavailable", async () => {
    const called: string[] = [];
    const llm: LLMFn = async (id) => {
      called.push(id);
      if (id === "primary/missing") throw new Error("GatewayModelNotFoundError");
      return `[{"matchId":"m1","pick":"home","stake":100,"reasoning":"a"},
        {"matchId":"m2","pick":"away","stake":200,"reasoning":"b"}]`;
    };
    const s = initialState(["ModelA"], 10_000, NOW);

    await placeBets(s, MATCHES, [
      { id: "primary/missing", fallbackIds: ["fallback/working"], name: "ModelA", color: "#fff" },
    ], llm, NOW);

    expect(called).toEqual(["primary/missing", "primary/missing", "fallback/working"]);
    expect(s.bets.map((b) => b.id)).toEqual(["m1:ModelA", "m2:ModelA"]);
    expect(s.meta.failures).toHaveLength(0);
  });

  test("retries when a model skips one of today's matches", async () => {
    let calls = 0;
    const llm: LLMFn = async () => {
      calls++;
      return calls === 1
        ? `[{"matchId":"m1","pick":"home","stake":100,"reasoning":"only one"}]`
        : `[{"matchId":"m1","pick":"home","stake":100,"reasoning":"a"},
            {"matchId":"m2","pick":"draw","stake":200,"reasoning":"b"}]`;
    };
    const s = initialState(["ModelA"], 10_000, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    expect(calls).toBe(2);
    expect(s.bets.map((b) => b.matchId)).toEqual(["m1", "m2"]);
  });

  test("records a failure and no partial bets if a model keeps skipping matches", async () => {
    const llm: LLMFn = async () =>
      `[{"matchId":"m1","pick":"home","stake":100,"reasoning":"only one"}]`;
    const s = initialState(["ModelA"], 10_000, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    expect(s.bets).toHaveLength(0);
    expect(s.meta.failures[0].reason).toContain("missing bets for matchIds: m2");
  });

  test("caps every individual stake before proportional slate scaling", async () => {
    const llm: LLMFn = async () =>
      `[{"matchId":"m1","pick":"home","stake":9000,"reasoning":"strong"},
        {"matchId":"m2","pick":"home","stake":3000,"reasoning":"small"}]`;
    const s = initialState(["ModelA"], 10_000, NOW);
    await placeBets(s, MATCHES, MODELS, llm, NOW);
    expect(s.bets.map((b) => b.stake)).toEqual([2_500, 2_500]);
  });

  test("does not add new stake when existing pending stake already uses the bankroll", async () => {
    let prompt = "";
    const llm: LLMFn = async (_id, p) => {
      prompt = p;
      return `[{"matchId":"m2","pick":"away","stake":2500,"reasoning":"still must pick"}]`;
    };
    const s = initialState(["ModelA"], 10_000, NOW);
    s.bets.push({
      id: "m1:ModelA", date: NOW, matchId: "m1", match: "France vs Spain",
      homeTeam: "France", awayTeam: "Spain", kickoff: "2026-06-11T16:00:00Z",
      model: "ModelA", pick: "home", stake: 10_000, odds: 1.8,
      reasoning: "already committed", status: "pending",
    });

    await placeBets(s, MATCHES, MODELS, llm, NOW);

    expect(prompt).toContain("Available cash for new bets: $0.00");
    expect(s.bets).toHaveLength(1);
  });

  test("scales new stakes against available cash after existing pending stake", async () => {
    const llm: LLMFn = async () =>
      `[{"matchId":"m2","pick":"away","stake":5000,"reasoning":"use available"}]`;
    const s = initialState(["ModelA"], 10_000, NOW);
    s.bets.push({
      id: "m1:ModelA", date: NOW, matchId: "m1", match: "France vs Spain",
      homeTeam: "France", awayTeam: "Spain", kickoff: "2026-06-11T16:00:00Z",
      model: "ModelA", pick: "home", stake: 7_000, odds: 1.8,
      reasoning: "already committed", status: "pending",
    });

    await placeBets(s, MATCHES, MODELS, llm, NOW);

    expect(s.bets).toHaveLength(2);
    expect(s.bets[1]).toMatchObject({ id: "m2:ModelA", stake: 2_500, pick: "away" });
  });
});
