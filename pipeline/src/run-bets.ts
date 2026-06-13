import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { placeBaselineBets } from "./baseline";
import { placeBets } from "./bets";
import { chartSVG } from "./chart";
import { BASELINE_NAME, FONT_PATH, MODELS, OG_PATH, SITE_URL, STATE_PATH } from "./config";
import { callGateway } from "./gateway";
import { fetchTodaysOdds } from "./odds";
import { fetchFifaReportDetails, fetchFifaReports, formatFifaReportContext } from "./fifa-reports";
import { renderPNG } from "./og";
import { postToX } from "./post";
import { composeCycleShare } from "./share";
import { loadState, saveState } from "./state";

const now = new Date().toISOString();
const names = [...MODELS.map((m) => m.name), BASELINE_NAME];
const state = loadState(STATE_PATH, names, now);

const odds = await fetchTodaysOdds(process.env.ODDS_API_KEY!);
console.log(`[bets] ${odds.length} matches in the next 24h`);
let fifaReportContext = "";
if (odds.length > 0) {
  try {
    const reports = await fetchFifaReports();
    for (const report of reports) {
      try {
        report.details = await fetchFifaReportDetails(report);
      } catch (e) {
        console.log(`[bets] FIFA report details unavailable for M${String(report.matchNo).padStart(2, "0")} — ${String(e)}`);
      }
    }
    fifaReportContext = formatFifaReportContext(odds, reports);
    console.log(`[bets] FIFA report context: ${fifaReportContext ? `${fifaReportContext.split("\n").length - 1} relevant reports` : "none relevant"}`);
  } catch (e) {
    console.log(`[bets] FIFA report context unavailable — ${String(e)}`);
  }
}
const beforeBetIds = new Set(state.bets.map((b) => b.id));
if (odds.length > 0) {
  await placeBets(state, odds, MODELS, callGateway, now, fifaReportContext);
  placeBaselineBets(state, odds, now);
}
const cycleMatchIds = new Set(odds.map((m) => m.matchId));
const newBets = state.bets.filter((b) => !beforeBetIds.has(b.id) && cycleMatchIds.has(b.matchId));
const cycleBets = state.bets.filter((b) => b.status === "pending" && cycleMatchIds.has(b.matchId));
const cyclePostKey = [...cycleMatchIds].sort().join("|");

if (process.env.DRY_RUN) {
  console.log(JSON.stringify(state.bets.filter((b) => b.date === now), null, 2));
  console.log("[bets] DRY_RUN — state not saved");
} else {
  mkdirSync(dirname(OG_PATH), { recursive: true });
  const png = renderPNG(chartSVG(state, 1200, 630, { og: true }), FONT_PATH);
  writeFileSync(OG_PATH, png);
  const hasXCreds = process.env.X_APP_KEY && process.env.X_APP_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_SECRET;
  if (newBets.length > 0 && cyclePostKey && state.meta.lastCyclePostKey !== cyclePostKey && hasXCreds) {
    try {
      await postToX(composeCycleShare(cycleBets, SITE_URL));
      state.meta.lastCyclePostKey = cyclePostKey;
      console.log(`[bets] posted cycle summary for ${cycleMatchIds.size} matches`);
    } catch (e) {
      console.log(`[bets] X cycle post failed — ${String(e)}`);
    }
  } else if (newBets.length > 0 && !hasXCreds) {
    console.log("[bets] X credentials missing — skipping cycle post");
  }
  saveState(STATE_PATH, state);
  console.log(`[bets] saved ${state.bets.filter((b) => b.status === "pending").length} pending bets`);
}
