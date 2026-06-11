import { describe, expect, test } from "bun:test";
import { fetchTodaysOdds } from "../src/odds";

const FIXTURE = [
  {
    id: "evt1", sport_key: "soccer_fifa_world_cup",
    commence_time: "2026-06-11T16:00:00Z",
    home_team: "France", away_team: "Spain",
    bookmakers: [
      { key: "pinnacle", markets: [{ key: "h2h", outcomes: [
        { name: "France", price: 1.8 }, { name: "Spain", price: 4.0 }, { name: "Draw", price: 3.5 },
      ]}]},
      { key: "bet365", markets: [{ key: "h2h", outcomes: [
        { name: "France", price: 1.9 }, { name: "Spain", price: 4.2 }, { name: "Draw", price: 3.6 },
      ]}]},
    ],
  },
  { // kicks off in 3 days — must be filtered out
    id: "evt2", sport_key: "soccer_fifa_world_cup",
    commence_time: "2026-06-14T16:00:00Z",
    home_team: "Brazil", away_team: "Japan",
    bookmakers: [],
  },
];

const fakeFetch = (async (url: string | URL) => {
  expect(String(url)).toContain("soccer_fifa_world_cup");
  expect(String(url)).toContain("apiKey=KEY");
  return new Response(JSON.stringify(FIXTURE), { status: 200 });
}) as typeof fetch;

describe("fetchTodaysOdds", () => {
  test("returns median odds for matches within 24h", async () => {
    const out = await fetchTodaysOdds("KEY", fakeFetch, new Date("2026-06-11T08:00:00Z"));
    expect(out).toEqual([{
      matchId: "evt1", homeTeam: "France", awayTeam: "Spain",
      kickoff: "2026-06-11T16:00:00Z",
      odds: { home: 1.85, draw: 3.55, away: 4.1 }, // median of 2 books = mean here
    }]);
  });

  test("throws on non-200", async () => {
    const bad = (async () => new Response("nope", { status: 401 })) as typeof fetch;
    await expect(fetchTodaysOdds("KEY", bad, new Date())).rejects.toThrow("the-odds-api 401");
  });
});
