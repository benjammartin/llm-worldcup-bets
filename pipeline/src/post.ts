import { TwitterApi } from "twitter-api-v2";
import { bankroll, type Bet, type State } from "./state";

const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

function xClient(): TwitterApi | null {
  const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) return null;
  return new TwitterApi({
    appKey: X_APP_KEY, appSecret: X_APP_SECRET,
    accessToken: X_ACCESS_TOKEN, accessSecret: X_ACCESS_SECRET,
  });
}

export function composeUpdate(
  s: State, match: string, score: string, settled: Bet[], _siteUrl?: string,
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
  const tail = `\n\n${standings}`;
  const budget = 280 - head.length - tail.length;
  const trimmedMoves = moves.length > budget ? moves.slice(0, Math.max(0, budget - 1)) + "…" : moves;
  return `${head}${trimmedMoves}${tail}`;
}

export async function postToX(text: string, png?: Buffer): Promise<void> {
  const client = xClient();
  if (!client) {
    console.log("[post] X credentials missing — skipping post");
    return;
  }
  if (png) {
    const mediaId = await client.v1.uploadMedia(png, { mimeType: "image/png" });
    await client.v1.tweet(text, { media_ids: mediaId });
  } else {
    await client.v1.tweet(text);
  }
}

export async function postToXWithReply(text: string, replyText: string, png?: Buffer): Promise<void> {
  const client = xClient();
  if (!client) {
    console.log("[post] X credentials missing — skipping post");
    return;
  }
  const first = png
    ? await client.v1.tweet(text, { media_ids: await client.v1.uploadMedia(png, { mimeType: "image/png" }) })
    : await client.v1.tweet(text);
  await client.v1.reply(replyText, first.id_str);
}
