import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initialState, loadState, saveState, bankroll, pendingStake, type State,
} from "../src/state";

const T0 = "2026-06-11T08:00:00Z";

describe("state", () => {
  test("initialState seeds one starting point per competitor", () => {
    const s = initialState(["Claude", "Baseline"], 10_000, T0);
    expect(s.series["Claude"]).toEqual([{ t: T0, bankroll: 10_000 }]);
    expect(s.bets).toEqual([]);
    expect(s.meta.promptVersion).toBe(1);
  });

  test("save/load roundtrip", () => {
    const p = join(tmpdir(), `state-${Date.now()}.json`);
    const s = initialState(["Claude"], 10_000, T0);
    saveState(p, s);
    expect(loadState(p, ["Claude"], T0)).toEqual(s);
  });

  test("loadState returns initialState when file is missing", () => {
    const s = loadState(join(tmpdir(), "nope-xyz.json"), ["Claude"], T0);
    expect(bankroll(s, "Claude")).toBe(10_000);
  });

  test("bankroll reads last series point; pendingStake sums pending bets", () => {
    const s: State = initialState(["Claude"], 10_000, T0);
    s.series["Claude"].push({ t: "2026-06-12T00:00:00Z", bankroll: 8_000 });
    s.bets.push(
      { id: "m1:Claude", date: T0, matchId: "m1", match: "France vs Spain",
        homeTeam: "France", awayTeam: "Spain", kickoff: T0, model: "Claude",
        pick: "home", stake: 500, odds: 1.8, reasoning: "x", status: "pending" },
      { id: "m2:Claude", date: T0, matchId: "m2", match: "Brazil vs Japan",
        homeTeam: "Brazil", awayTeam: "Japan", kickoff: T0, model: "Claude",
        pick: "away", stake: 300, odds: 6.0, reasoning: "y", status: "lost" },
    );
    expect(bankroll(s, "Claude")).toBe(8_000);
    expect(pendingStake(s, "Claude")).toBe(500);
  });
});
