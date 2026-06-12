import { describe, expect, test } from "bun:test";
import { initialState, type Bet } from "../src/state";
import { applySettlement, settleDelta } from "../src/settle";

const bet = (over: Partial<Bet>): Bet => ({
  id: "m1:Claude", date: "2026-06-11T08:00:00Z", matchId: "m1",
  match: "France vs Spain", homeTeam: "France", awayTeam: "Spain",
  kickoff: "2026-06-11T16:00:00Z", model: "Claude", pick: "home",
  stake: 1_000, odds: 1.85, reasoning: "r", status: "pending", ...over,
});

describe("settleDelta", () => {
  test("win pays stake × (odds − 1)", () =>
    expect(settleDelta(bet({}), "home")).toBeCloseTo(850));
  test("loss costs the stake", () =>
    expect(settleDelta(bet({}), "away")).toBe(-1_000));
  test("void returns 0", () =>
    expect(settleDelta(bet({}), "void")).toBe(0));
});

describe("applySettlement", () => {
  test("updates status and pushes a floored series point", () => {
    const s = initialState(["Claude"], 500, "2026-06-11T08:00:00Z");
    const b = bet({ stake: 800, pick: "draw" }); // overcommitted: loss > bankroll
    s.bets.push(b);
    applySettlement(s, b, "home", "2026-06-11T18:00:00Z");
    expect(b.status).toBe("lost");
    expect(s.series["Claude"]).toEqual([
      { t: "2026-06-11T08:00:00Z", bankroll: 500 },
      { t: "2026-06-11T18:00:00Z", bankroll: 0 }, // floored, never negative
    ]);
  });

  test("void restores pending stake without bankroll change", () => {
    const s = initialState(["Claude"], 1_000, "2026-06-11T08:00:00Z");
    const b = bet({});
    s.bets.push(b);
    applySettlement(s, b, "void", "2026-06-11T18:00:00Z");
    expect(b.status).toBe("void");
    expect(s.series["Claude"].length).toBe(2);
    expect(s.series["Claude"][1].bankroll).toBe(1_000);
  });

  test("persists the settled result and score on every bet so the UI can explain all-lost matches", () => {
    const s = initialState(["Claude"], 1_000, "2026-06-11T08:00:00Z");
    const b = bet({ pick: "home" });
    s.bets.push(b);
    applySettlement(s, b, "away", "2026-06-11T18:00:00Z", "0-1");
    expect(b.status).toBe("lost");
    expect(b.settledResult).toBe("away");
    expect(b.settledScore).toBe("0-1");
  });
});
