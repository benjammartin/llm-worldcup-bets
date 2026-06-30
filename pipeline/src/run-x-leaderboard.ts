import { readFileSync } from "node:fs";
import { BASELINE_NAME, MODELS, OG_PATH, SITE_URL, STATE_PATH } from "./config";
import { postToXWithReply } from "./post";
import { loadState } from "./state";

const dryRun = process.env.DRY_RUN !== "0";
const now = new Date().toISOString();
const names = [...MODELS.map((m) => m.name), BASELINE_NAME];
const state = loadState(STATE_PATH, names, now);
const rows = Object.keys(state.series)
  .map((name) => ({ name, bankroll: state.series[name][state.series[name].length - 1].bankroll }))
  .sort((a, b) => b.bankroll - a.bankroll)
  .map((row, i) => `${i + 1}. ${row.name} $${Math.round(row.bankroll).toLocaleString("en-US")}`);

const latestSummary = process.env.LATEST_SUMMARY?.trim() || "Germany 1-1 Paraguay. Netherlands 1-1 Morocco.";
const text = [
  "LLM World Cup leaderboard",
  "",
  latestSummary,
  "",
  ...rows,
].join("\n");

if (text.length > 280) {
  throw new Error(`[x-leaderboard] tweet too long: ${text.length}`);
}

console.log(`[x-leaderboard] length: ${text.length}`);
console.log(`\n--- leaderboard tweet ---\n${text}`);

if (dryRun) {
  console.log("[x-leaderboard] DRY_RUN enabled — not posting");
  process.exit(0);
}

const png = readFileSync(OG_PATH);
await postToXWithReply(text, SITE_URL, png);
console.log("[x-leaderboard] posted leaderboard");
