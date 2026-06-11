import type { Pick3 } from "./state";

export interface RawBet { matchId: string; pick: Pick3; stake: number; reasoning: string; }

const PICKS: Record<string, Pick3> = {
  home: "home", draw: "draw", away: "away",
  "1": "home", x: "draw", "2": "away",
  "home win": "home", "away win": "away", tie: "draw",
};

export function extractBets(text: string): RawBet[] {
  const start = Math.min(...["[", "{"].map((c) => {
    const i = text.indexOf(c);
    return i === -1 ? Infinity : i;
  }));
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  if (!isFinite(start) || end <= start) throw new Error("no JSON found in reply");
  const parsed = JSON.parse(text.slice(start, end + 1));
  const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  return items.flatMap((it) => {
    const o = it as Record<string, unknown>;
    const pick = PICKS[String(o.pick ?? "").trim().toLowerCase()];
    const stake = Number(o.stake);
    if (!pick || !isFinite(stake) || stake < 0 || !o.matchId) return [];
    return [{ matchId: String(o.matchId), pick, stake, reasoning: String(o.reasoning ?? "") }];
  });
}
