import { TwitterApi } from "twitter-api-v2";
import { LAUNCH_LINK_REPLY, LAUNCH_THREAD, X_HANDLE, X_PROFILE } from "./x-profile";

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

const dryRun = process.env.DRY_RUN !== "0";
const postLaunchThread = process.env.POST_LAUNCH_THREAD === "1";

console.log(`[x-profile] expected handle: @${X_HANDLE}`);
console.log("[x-profile] target profile:", JSON.stringify(X_PROFILE, null, 2));
console.log(`[x-profile] launch thread posts: ${LAUNCH_THREAD.length}`);

if (dryRun) {
  console.log("[x-profile] DRY_RUN enabled — not updating X");
  for (const [i, text] of LAUNCH_THREAD.entries()) {
    console.log(`\n--- launch post ${i + 1}/${LAUNCH_THREAD.length} (${text.length} chars) ---\n${text}`);
  }
  console.log(`\n--- launch link reply (${LAUNCH_LINK_REPLY.length} chars) ---\n${LAUNCH_LINK_REPLY}`);
  process.exit(0);
}

const client = xClient();
if (!client) {
  console.error("[x-profile] X credentials missing — set X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET");
  process.exit(1);
}

try {
  await client.v1.updateAccountProfile(X_PROFILE);
  console.log("[x-profile] profile updated");
} catch (error) {
  const data = (error as { data?: { errors?: Array<{ code?: number; message?: string }> } }).data;
  const profileUpdateBlocked = data?.errors?.some((item) => item.code === 120 || item.code === 131);
  if (!profileUpdateBlocked) throw error;

  console.warn("[x-profile] profile update skipped — X rejected the profile update for now; continuing with launch thread");
}

if (postLaunchThread) {
  let previousTweetId: string | undefined;
  for (const text of LAUNCH_THREAD) {
    const tweet = await client.v2.tweet(previousTweetId ? { text, reply: { in_reply_to_tweet_id: previousTweetId } } : { text });
    previousTweetId = tweet.data.id;
    console.log(`[x-profile] posted launch tweet ${previousTweetId}`);
  }

  if (previousTweetId) {
    const reply = await client.v2.tweet({ text: LAUNCH_LINK_REPLY, reply: { in_reply_to_tweet_id: previousTweetId } });
    console.log(`[x-profile] posted launch link reply ${reply.data.id}`);
  }
} else {
  console.log("[x-profile] launch thread skipped — set POST_LAUNCH_THREAD=1 to post it");
}
