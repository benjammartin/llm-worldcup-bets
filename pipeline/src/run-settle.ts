import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chartSVG } from "./chart";
import { BASELINE_NAME, FONT_PATH, MODELS, OG_PATH, SITE_URL, STATE_PATH } from "./config";
import { updatePerformance } from "./performance";
import { renderPNG } from "./og";
import { composeUpdate, postToXWithReply } from "./post";
import { fetchFinished } from "./scores";
import { applySettlement } from "./settle";
import { loadState, saveState } from "./state";
import { sameMatch } from "./teams";

const now = new Date().toISOString();
const names = [...MODELS.map((m) => m.name), BASELINE_NAME];
const state = loadState(STATE_PATH, names, now);

updatePerformance(state, names);
saveState(STATE_PATH, state);

const pending = state.bets.filter((b) => b.status === "pending");
if (pending.length === 0) { console.log("[settle] no pending bets"); process.exit(0); }

const day = 24 * 3600 * 1000;
const dateFrom = new Date(Date.now() - 2 * day).toISOString().slice(0, 10);
const dateTo = new Date(Date.now() + day).toISOString().slice(0, 10);
const finished = await fetchFinished(process.env.FOOTBALL_DATA_TOKEN!, dateFrom, dateTo);

const settledMatches: { match: string; score: string; bets: typeof pending }[] = [];
for (const fm of finished) {
  const bets = pending.filter((b) => b.status === "pending" && sameMatch(b.homeTeam, b.awayTeam, fm.homeTeam, fm.awayTeam));
  if (bets.length === 0) continue;
  for (const b of bets) applySettlement(state, b, fm.result, now, fm.score);
  settledMatches.push({ match: bets[0].match, score: fm.score, bets });
}

if (settledMatches.length === 0) { console.log("[settle] nothing new"); process.exit(0); }

state.meta.lastSettleRun = now;
updatePerformance(state, names);
saveState(STATE_PATH, state);
const png = renderPNG(chartSVG(state, 1200, 630, { og: true }), FONT_PATH);
mkdirSync(dirname(OG_PATH), { recursive: true });
writeFileSync(OG_PATH, png);
console.log(`[settle] settled ${settledMatches.length} match(es)`);

for (const sm of settledMatches) {
  try {
    await postToXWithReply(composeUpdate(state, sm.match, sm.score, sm.bets), SITE_URL, png);
  } catch (e) {
    console.error(`[post] failed for ${sm.match}: ${e}`);
  }
}
