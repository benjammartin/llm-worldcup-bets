import { readFileSync } from "node:fs";
import { BASELINE_NAME, MODELS, OG_PATH, SITE_URL, STATE_PATH } from "./config";
import { composeUpdate, postToXWithReply } from "./post";
import { loadState } from "./state";

const defaultMatches = ["Germany vs Paraguay", "Netherlands vs Morocco"];
const requestedMatches = (process.env.BACKFILL_MATCHES || defaultMatches.join("|"))
  .split("|")
  .map((s) => s.trim())
  .filter(Boolean);
const dryRun = process.env.DRY_RUN !== "0";
const now = new Date().toISOString();
const names = [...MODELS.map((m) => m.name), BASELINE_NAME];
const state = loadState(STATE_PATH, names, now);
const png = readFileSync(OG_PATH);

const payloads = requestedMatches.map((match) => {
  const settled = state.bets.filter((b) => b.match === match && b.status !== "pending");
  if (settled.length === 0) {
    throw new Error(`[x-settlement-backfill] no settled bets found for ${match}`);
  }
  const scores = [...new Set(settled.map((b) => b.settledScore).filter(Boolean))];
  if (scores.length !== 1) {
    throw new Error(`[x-settlement-backfill] expected exactly one settled score for ${match}, got: ${scores.join(", ")}`);
  }
  const text = composeUpdate(state, match, scores[0]!, settled, SITE_URL);
  if (/https?:\/\//i.test(text)) {
    throw new Error(`[x-settlement-backfill] main tweet for ${match} unexpectedly contains a link`);
  }
  if (text.length > 280) {
    throw new Error(`[x-settlement-backfill] tweet too long for ${match}: ${text.length}`);
  }
  return { match, score: scores[0]!, settled, text };
});

console.log(`[x-settlement-backfill] matches: ${payloads.length}`);
for (const payload of payloads) {
  console.log(`\n--- ${payload.match} (${payload.text.length} chars) ---\n${payload.text}`);
}

if (dryRun) {
  console.log("[x-settlement-backfill] DRY_RUN enabled — not posting");
  process.exit(0);
}

for (const payload of payloads) {
  await postToXWithReply(payload.text, SITE_URL, png);
  console.log(`[x-settlement-backfill] posted ${payload.match}`);
}
