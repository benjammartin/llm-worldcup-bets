import { describe, expect, test } from "bun:test";
import { extractBets } from "../src/parse";

describe("extractBets", () => {
  test("parses a clean JSON array", () => {
    const out = extractBets(`[{"matchId":"m1","pick":"home","stake":500,"reasoning":"ok"}]`);
    expect(out).toEqual([{ matchId: "m1", pick: "home", stake: 500, reasoning: "ok" }]);
  });

  test("strips markdown fences and prose around the JSON", () => {
    const txt = "Sure! Here are my bets:\n```json\n[{\"matchId\":\"m1\",\"pick\":\"away\",\"stake\":250,\"reasoning\":\"upset\"}]\n```\nGood luck!";
    expect(extractBets(txt)[0].pick).toBe("away");
  });

  test("wraps a single object into an array", () => {
    const out = extractBets(`{"matchId":"m1","pick":"draw","stake":100,"reasoning":"tight"}`);
    expect(out).toHaveLength(1);
  });

  test("normalizes pick synonyms (1/X/2, Home Win)", () => {
    const txt = `[{"matchId":"m1","pick":"1","stake":10,"reasoning":"a"},
                  {"matchId":"m2","pick":"X","stake":10,"reasoning":"b"},
                  {"matchId":"m3","pick":"Home Win","stake":10,"reasoning":"c"}]`;
    expect(extractBets(txt).map((b) => b.pick)).toEqual(["home", "draw", "home"]);
  });

  test("drops entries with invalid pick or non-numeric stake, keeps valid ones", () => {
    const txt = `[{"matchId":"m1","pick":"both","stake":10,"reasoning":"?"},
                  {"matchId":"m2","pick":"away","stake":"lots","reasoning":"?"},
                  {"matchId":"m3","pick":"away","stake":40,"reasoning":"ok"}]`;
    expect(extractBets(txt)).toEqual([{ matchId: "m3", pick: "away", stake: 40, reasoning: "ok" }]);
  });

  test("drops prototype-chain pick names like 'constructor'", () => {
    const txt = `[{"matchId":"m1","pick":"constructor","stake":10,"reasoning":"?"},
                  {"matchId":"m2","pick":"home","stake":20,"reasoning":"ok"}]`;
    expect(extractBets(txt)).toEqual([{ matchId: "m2", pick: "home", stake: 20, reasoning: "ok" }]);
  });

  test("throws on text with no JSON at all", () => {
    expect(() => extractBets("I refuse to gamble.")).toThrow();
  });
});
