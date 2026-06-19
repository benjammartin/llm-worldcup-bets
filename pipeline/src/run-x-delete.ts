import { TwitterApi } from "twitter-api-v2";
import { X_HANDLE } from "./x-profile";

function xClient(): TwitterApi | null {
  const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) return null;
  return new TwitterApi({
    appKey: X_APP_KEY,
    appSecret: X_APP_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  });
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[x-delete] missing ${name}`);
    process.exit(1);
  }
  return value;
}

function tweetIdFromInput(input: string): string {
  const match = input.match(/status\/(\d+)/) ?? input.match(/^(\d+)$/);
  if (!match) {
    console.error(`[x-delete] tweet id must be a tweet ID or status URL, got: ${input}`);
    process.exit(1);
  }
  return match[1];
}

const tweetIds = requireEnv("TWEET_IDS")
  .split(/[\s,]+/)
  .map((id) => id.trim())
  .filter(Boolean)
  .map(tweetIdFromInput);
const dryRun = process.env.DRY_RUN !== "0";

console.log(`[x-delete] expected handle: @${X_HANDLE}`);
console.log(`[x-delete] tweet ids: ${tweetIds.join(", ")}`);

if (dryRun) {
  console.log("[x-delete] DRY_RUN enabled — not deleting");
  process.exit(0);
}

const client = xClient();
if (!client) {
  console.error("[x-delete] X credentials missing — set X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET");
  process.exit(1);
}

for (const tweetId of tweetIds) {
  const result = await client.v2.deleteTweet(tweetId);
  console.log(`[x-delete] deleted ${tweetId}: ${JSON.stringify(result.data)}`);
}
