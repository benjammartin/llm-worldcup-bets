import { TwitterApi } from "twitter-api-v2";
import { X_HANDLE, X_PROFILE } from "./x-profile";

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
    console.error(`[x-reply] missing ${name}`);
    process.exit(1);
  }
  return value;
}

function tweetIdFromInput(input: string): string {
  const match = input.match(/status\/(\d+)/) ?? input.match(/^(\d+)$/);
  if (!match) {
    console.error(`[x-reply] TARGET_TWEET_ID must be a tweet ID or status URL, got: ${input}`);
    process.exit(1);
  }
  return match[1];
}

const targetTweetId = tweetIdFromInput(requireEnv("TARGET_TWEET_ID"));
const text = requireEnv("TWEET_TEXT");
const siteUrl = (process.env.SITE_URL?.trim() || X_PROFILE.url).replace(/\/$/, "");
const replyText = `Track the LLM bankrolls here:\n${siteUrl}`;
const mode = process.env.POST_MODE?.trim() || "reply";
const dryRun = process.env.DRY_RUN !== "0";

if (!["reply", "quote"].includes(mode)) {
  console.error(`[x-reply] POST_MODE must be reply or quote, got: ${mode}`);
  process.exit(1);
}

if (/https?:\/\//i.test(text)) {
  console.error("[x-reply] main tweet must not include links; put links in the follow-up reply");
  process.exit(1);
}

if (text.length > 280 || replyText.length > 280) {
  console.error(`[x-reply] tweet too long: main=${text.length}, linkReply=${replyText.length}`);
  process.exit(1);
}

console.log(`[x-reply] expected handle: @${X_HANDLE}`);
console.log(`[x-reply] mode: ${mode}`);
console.log(`[x-reply] target tweet: ${targetTweetId}`);
console.log(`[x-reply] main length: ${text.length}`);
console.log(`[x-reply] reply length: ${replyText.length}`);

if (dryRun) {
  console.log("[x-reply] DRY_RUN enabled — not posting");
  console.log(`\n--- main reply ---\n${text}`);
  console.log(`\n--- link reply ---\n${replyText}`);
  process.exit(0);
}

const client = xClient();
if (!client) {
  console.error("[x-reply] X credentials missing — set X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET");
  process.exit(1);
}

const first = mode === "quote"
  ? await client.v2.tweet({ text, quote_tweet_id: targetTweetId })
  : await client.v2.tweet({ text, reply: { in_reply_to_tweet_id: targetTweetId } });
console.log(`[x-reply] posted ${mode} challenge ${first.data.id}`);
const second = await client.v2.tweet({ text: replyText, reply: { in_reply_to_tweet_id: first.data.id } });
console.log(`[x-reply] posted link reply ${second.data.id}`);
