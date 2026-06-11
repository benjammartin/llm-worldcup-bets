import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { placeBaselineBets } from "./baseline";
import { placeBets } from "./bets";
import { chartSVG } from "./chart";
import { BASELINE_NAME, FONT_PATH, MODELS, OG_PATH, STATE_PATH } from "./config";
import { callGateway } from "./gateway";
import { fetchTodaysOdds } from "./odds";
import { renderPNG } from "./og";
import { loadState, saveState } from "./state";

const now = new Date().toISOString();
const names = [...MODELS.map((m) => m.name), BASELINE_NAME];
const state = loadState(STATE_PATH, names, now);

const odds = await fetchTodaysOdds(process.env.ODDS_API_KEY!);
console.log(`[bets] ${odds.length} matches in the next 24h`);
if (odds.length > 0) {
  await placeBets(state, odds, MODELS, callGateway, now);
  placeBaselineBets(state, odds, now);
}

if (process.env.DRY_RUN) {
  console.log(JSON.stringify(state.bets.filter((b) => b.date === now), null, 2));
  console.log("[bets] DRY_RUN — state not saved");
} else {
  saveState(STATE_PATH, state);
  mkdirSync(dirname(OG_PATH), { recursive: true });
  writeFileSync(OG_PATH, renderPNG(chartSVG(state), FONT_PATH));
  console.log(`[bets] saved ${state.bets.filter((b) => b.status === "pending").length} pending bets`);
}
