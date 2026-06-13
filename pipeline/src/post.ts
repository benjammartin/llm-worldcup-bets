import { TwitterApi } from "twitter-api-v2";
import { bankroll, type Bet, type State } from "./state";

const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

export function composeUpdate(
  s: State, match: string, score: string, settled: Bet[], siteUrl: string,
): string {
  const moves = settled
    .filter((b) => b.status !== "void")
    .map((b) => ({
      name: b.model,
      delta: b.status === "won" ? b.stake * (b.odds - 1) : -b.stake,
    }))
    .sort((a, b) => b.delta - a.delta)
    .map((m) => `${m.name} ${m.delta >= 0 ? "+" : "-"}${fmt(m.delta)}`)
    .join(" · ");

  const standings = Object.keys(s.series)
    .sort((a, b) => bankroll(s, b) - bankroll(s, a))
    .slice(0, 3)
    .map((n, i) => `${i + 1}. ${n} ${fmt(bankroll(s, n))}`)
    .join(" ");

  const head = `FT: ${match} (${score})\n`;
  const tail = `\n\n${standings}\n${siteUrl}`;
  const budget = 280 - head.length - tail.length;
  const trimmedMoves = moves.length > budget ? moves.slice(0, Math.max(0, budget - 1)) + "…" : moves;
  return `${head}${trimmedMoves}${tail}`;
}

export async function postToX(text: string, png?: Buffer): Promise<void> {
  const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    console.log("[post] X credentials missing — skipping post");
    return;
  }
  const client = new TwitterApi({
    appKey: X_APP_KEY, appSecret: X_APP_SECRET,
    accessToken: X_ACCESS_TOKEN, accessSecret: X_ACCESS_SECRET,
  });
  if (png) {
    const mediaId = await client.v1.uploadMedia(png, { mimeType: "image/png" });
    await client.v2.tweet({ text, media: { media_ids: [mediaId] } });
  } else {
    await client.v2.tweet(text);
  }
}
