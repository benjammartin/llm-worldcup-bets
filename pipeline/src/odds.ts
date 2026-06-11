export interface MatchOdds {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  odds: { home: number; draw: number; away: number };
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 100) / 100;
};

export async function fetchTodaysOdds(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<MatchOdds[]> {
  const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&dateFormat=iso`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`the-odds-api ${res.status}`);
  const events = (await res.json()) as any[];
  const horizon = now.getTime() + 24 * 3600 * 1000;

  return events
    .filter((e) => {
      const t = new Date(e.commence_time).getTime();
      return t > now.getTime() - 3600 * 1000 && t < horizon && e.bookmakers?.length;
    })
    .map((e) => {
      const prices: Record<string, number[]> = { home: [], draw: [], away: [] };
      for (const bk of e.bookmakers) {
        const h2h = bk.markets?.find((m: any) => m.key === "h2h");
        for (const o of h2h?.outcomes ?? []) {
          const side = o.name === "Draw" ? "draw" : o.name === e.home_team ? "home" : "away";
          prices[side].push(o.price);
        }
      }
      return {
        matchId: e.id, homeTeam: e.home_team, awayTeam: e.away_team,
        kickoff: e.commence_time,
        odds: { home: median(prices.home), draw: median(prices.draw), away: median(prices.away) },
      };
    });
}
