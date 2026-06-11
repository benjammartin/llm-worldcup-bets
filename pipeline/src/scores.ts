import type { Pick3 } from "./state";

export interface FinishedMatch {
  homeTeam: string;
  awayTeam: string;
  result: Pick3;
  score: string; // "2-0"
  utcDate: string;
}

const WINNER: Record<string, Pick3> = Object.assign(Object.create(null), {
  HOME_TEAM: "home", AWAY_TEAM: "away", DRAW: "draw",
});

export async function fetchFinished(
  token: string,
  dateFrom: string, // YYYY-MM-DD
  dateTo: string,
  fetchFn: typeof fetch = fetch,
): Promise<FinishedMatch[]> {
  const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const res = await fetchFn(url, { headers: { "X-Auth-Token": token } });
  if (!res.ok) throw new Error(`football-data ${res.status}`);
  const body = (await res.json()) as any;
  return (body.matches as any[])
    .filter((m) => m.status === "FINISHED" && m.score?.winner)
    .map((m) => ({
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      result: WINNER[m.score.winner as string],
      score: `${m.score.fullTime.home}-${m.score.fullTime.away}`,
      utcDate: m.utcDate,
    }));
}
