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

  test("replaces unstarted pending bets so a model can rebalance before kickoff", async () => {
    let prompt = "";
    const llm: LLMFn = async (_id, p) => {
      prompt = p;
      return `[{"matchId":"m1","pick":"draw","stake":1500,"reasoning":"rebalance old"},
        {"matchId":"m2","pick":"away","stake":2500,"reasoning":"add new"}]`;
    };
    const s = initialState(["ModelA"], 10_000, NOW);
    s.bets.push({
      id: "m1:ModelA", date: "2026-06-11T07:00:00Z", matchId: "m1", match: "France vs Spain",
      homeTeam: "France", awayTeam: "Spain", kickoff: "2026-06-11T16:00:00Z",
      model: "ModelA", pick: "home", stake: 10_000, odds: 1.8,
      reasoning: "all-in before later match appeared", status: "pending",
    });

    await placeBets(s, MATCHES, MODELS, llm, NOW);

    expect(prompt).toContain("Available cash for open bets: $10000.00");
    expect(s.bets).toHaveLength(2);
    expect(s.bets.find((b) => b.matchId === "m1")).toMatchObject({
      id: "m1:ModelA", pick: "draw", stake: 1_500, odds: 3.5,
      reasoning: "rebalance old", date: NOW,
    });
    expect(s.bets.find((b) => b.matchId === "m2")).toMatchObject({
      id: "m2:ModelA", pick: "away", stake: 2_500, odds: 6,
    });
  });

  test("keeps already-started pending bets locked and scales only against remaining cash", async () => {
    const afterM1Kickoff = "2026-06-11T17:00:00Z";
    const llm: LLMFn = async () =>
      `[{"matchId":"m2","pick":"away","stake":5000,"reasoning":"use available"}]`;
    const s = initialState(["ModelA"], 10_000, NOW);
    s.bets.push({
      id: "m1:ModelA", date: NOW, matchId: "m1", match: "France vs Spain",
      homeTeam: "France", awayTeam: "Spain", kickoff: "2026-06-11T16:00:00Z",
      model: "ModelA", pick: "home", stake: 7_000, odds: 1.8,
      reasoning: "locked after kickoff", status: "pending",
    });

    await placeBets(s, MATCHES, MODELS, llm, afterM1Kickoff);

    expect(s.bets).toHaveLength(2);
    expect(s.bets[0]).toMatchObject({ id: "m1:ModelA", stake: 7_000, pick: "home" });
    expect(s.bets[1]).toMatchObject({ id: "m2:ModelA", stake: 2_500, pick: "away" });
  });

  test("passes official FIFA report context into the model prompt when supplied", async () => {
    let prompt = "";
    const llm: LLMFn = async (_id, p) => {
      prompt = p;
      return `[{"matchId":"m1","pick":"home","stake":100,"reasoning":"fifa context"},
        {"matchId":"m2","pick":"away","stake":200,"reasoning":"fifa context"}]`;
    };
    const s = initialState(["ModelA"], 10_000, NOW);

    await placeBets(s, MATCHES, MODELS, llm, NOW, "Official FIFA Training Centre context");

    expect(prompt).toContain("Official FIFA Training Centre context");
    expect(prompt).toContain("odds remain the primary probability signal");
  });
});
