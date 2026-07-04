import type { LiveMatch, Pick3 } from "./state";

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

export async function fetchLiveMatches(
  token: string,
  dateFrom: string, // YYYY-MM-DD
  dateTo: string,
  fetchFn: typeof fetch = fetch,
): Promise<LiveMatch[]> {
  const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const res = await fetchFn(url, { headers: { "X-Auth-Token": token } });
  if (!res.ok) throw new Error(`football-data ${res.status}`);
  const body = (await res.json()) as any;
  return (body.matches as any[])
    .filter((m) => ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status))
    .map((m) => ({
      matchId: String(m.id ?? `${m.homeTeam?.name}-${m.awayTeam?.name}-${m.utcDate}`),
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      kickoff: m.utcDate,
      status: m.status,
    }));
}

function regularTimeScore(score: any): { home: number; away: number } | null {
  const duration = score?.duration ?? "REGULAR";
  if (duration === "REGULAR") {
    const full = score?.fullTime;
    return full?.home != null && full?.away != null ? full : null;
  }

  const regular = score?.regularTime;
  if (regular?.home != null && regular?.away != null) return regular;

  const full = score?.fullTime;
  const extra = score?.extraTime;
  if (full?.home != null && full?.away != null && extra?.home != null && extra?.away != null) {
    return { home: full.home - extra.home, away: full.away - extra.away };
  }

  return null;
}

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
    .filter((m) => m.status === "FINISHED")
    .flatMap((m) => {
      // 1X2 odds settle on the 90-minute result; for ET/pens matches,
      // score.winner is the post-ET/pens winner and fullTime includes ET goals.
      const duration = m.score?.duration ?? "REGULAR";
      const regular = regularTimeScore(m.score);
      if (regular == null || regular.home == null || regular.away == null) return [];
      const result: Pick3 =
        regular.home > regular.away ? "home" :
        regular.home < regular.away ? "away" :
        "draw";
      if (duration === "REGULAR" && !WINNER[m.score?.winner as string]) return [];
      return [{
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        result,
        score: `${regular.home}-${regular.away}`,
        utcDate: m.utcDate,
      }];
    });
}
