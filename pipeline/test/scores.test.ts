import { describe, expect, test } from "bun:test";
import { fetchFinished } from "../src/scores";

const FIXTURE = {
  matches: [
    { utcDate: "2026-06-11T16:00:00Z", status: "FINISHED",
      homeTeam: { name: "France" }, awayTeam: { name: "Spain" },
      score: { winner: "HOME_TEAM", fullTime: { home: 2, away: 0 } } },
    { utcDate: "2026-06-11T19:00:00Z", status: "FINISHED",
      homeTeam: { name: "Korea Republic" }, awayTeam: { name: "Portugal" },
      score: { winner: "DRAW", fullTime: { home: 1, away: 1 } } },
    { utcDate: "2026-06-11T22:00:00Z", status: "IN_PLAY",
      homeTeam: { name: "Brazil" }, awayTeam: { name: "Japan" },
      score: { winner: null, fullTime: { home: null, away: null } } },
  ],
};

const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
  expect(String(url)).toContain("competitions/WC/matches");
  expect((init?.headers as Record<string, string>)["X-Auth-Token"]).toBe("TOKEN");
  return new Response(JSON.stringify(FIXTURE), { status: 200 });
}) as unknown as typeof fetch;

describe("fetchFinished", () => {
  test("maps FINISHED matches to results, skips in-play", async () => {
    const out = await fetchFinished("TOKEN", "2026-06-09", "2026-06-12", fakeFetch);
    expect(out).toEqual([
      { homeTeam: "France", awayTeam: "Spain", result: "home",
        score: "2-0", utcDate: "2026-06-11T16:00:00Z" },
      { homeTeam: "Korea Republic", awayTeam: "Portugal", result: "draw",
        score: "1-1", utcDate: "2026-06-11T19:00:00Z" },
    ]);
  });

  test("settles on the 90-minute result for ET/penalty matches", async () => {
    const fixture = { matches: [
      { utcDate: "2026-06-29T20:00:00Z", status: "FINISHED",
        homeTeam: { name: "France" }, awayTeam: { name: "Italy" },
        score: { winner: "HOME_TEAM", duration: "PENALTY_SHOOTOUT",
          fullTime: { home: 1, away: 1 }, regularTime: { home: 1, away: 1 } } },
      { utcDate: "2026-06-29T23:00:00Z", status: "FINISHED",
        homeTeam: { name: "Brazil" }, awayTeam: { name: "Japan" },
        score: { winner: "HOME_TEAM", duration: "EXTRA_TIME",
          fullTime: { home: 2, away: 1 }, regularTime: { home: 1, away: 1 } } },
    ]};
    const f = (async () => new Response(JSON.stringify(fixture), { status: 200 })) as unknown as typeof fetch;
    const out = await fetchFinished("TOKEN", "2026-06-28", "2026-06-30", f);
    expect(out).toEqual([
      { homeTeam: "France", awayTeam: "Italy", result: "draw", score: "1-1", utcDate: "2026-06-29T20:00:00Z" },
      { homeTeam: "Brazil", awayTeam: "Japan", result: "draw", score: "1-1", utcDate: "2026-06-29T23:00:00Z" },
    ]);
  });

  test("skips matches with an unknown winner value instead of emitting undefined", async () => {
    const fixture = { matches: [
      { utcDate: "2026-06-11T16:00:00Z", status: "FINISHED",
        homeTeam: { name: "France" }, awayTeam: { name: "Spain" },
        score: { winner: "SOMETHING_NEW", duration: "REGULAR", fullTime: { home: 2, away: 0 } } },
    ]};
    const f = (async () => new Response(JSON.stringify(fixture), { status: 200 })) as unknown as typeof fetch;
    const out = await fetchFinished("TOKEN", "2026-06-09", "2026-06-12", f);
    expect(out).toEqual([]);
  });
});
