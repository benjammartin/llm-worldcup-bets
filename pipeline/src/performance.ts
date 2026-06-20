import type { Bet, Pick3, State } from "./state";

export interface ModelPerformance {
  model: string;
  totalBets: number;
  won: number;
  lost: number;
  void: number;
  totalStake: number;
  totalReturn: number; // sum of profit/loss (negative for losses)
  roi: number; // totalReturn / totalStake
  avgOdds: number;
  recentBets: Bet[];
}

export function computePerformance(bets: Bet[], model: string): ModelPerformance {
  const settled = bets.filter(b => b.model === model && (b.status === "won" || b.status === "lost" || b.status === "void"));
  const won = settled.filter(b => b.status === "won");
  const lost = settled.filter(b => b.status === "lost");
  const voided = settled.filter(b => b.status === "void");
  const totalStake = settled.reduce((sum, b) => sum + b.stake, 0);
  const totalReturn = settled.reduce((sum, b) => {
    if (b.status === "won") return sum + (b.stake * (b.odds - 1));
    if (b.status === "lost") return sum - b.stake;
    return sum; // void: stake returned, profit 0
  }, 0);
  const avgOdds = settled.length > 0
    ? settled.reduce((sum, b) => sum + b.odds, 0) / settled.length
    : 0;
  const roi = totalStake > 0 ? totalReturn / totalStake : 0;
  const recentBets = settled.slice(-10); // last 10 settled bets
  
  return {
    model,
    totalBets: settled.length,
    won: won.length,
    lost: lost.length,
    void: voided.length,
    totalStake,
    totalReturn,
    roi,
    avgOdds,
    recentBets,
  };
}

export function computeAllPerformances(bets: Bet[], models: string[]): Record<string, ModelPerformance> {
  const result: Record<string, ModelPerformance> = {};
  for (const model of models) {
    result[model] = computePerformance(bets, model);
  }
  return result;
}

/**
 * Compute a confidence score between 0 and 1 based on ROI and sample size.
 * Higher ROI and more bets => higher confidence.
 */
export function confidenceScore(perf: ModelPerformance): number {
  if (perf.totalBets < 3) return 0.5; // neutral
  // ROI normalized to [-1, 1] but ROI can be >1 if odds high, cap at 2
  const roiClamped = Math.max(-1, Math.min(2, perf.roi));
  // map ROI from [-1, 2] to [0, 1] where 0 is -1, 0.5 is 0, 1 is 2
  const roiScore = (roiClamped + 1) / 3;
  // weight by log of sample size, max at ~20 bets
  const sampleWeight = Math.min(1, Math.log10(perf.totalBets + 1) / Math.log10(20));
  return 0.5 + (roiScore - 0.5) * sampleWeight;
}

/**
 * Adjust max stake ratio based on confidence.
 * Returns multiplier between 0.5 and 1.5 (or other bounds).
 */
export function stakeRatioMultiplier(perf: ModelPerformance): number {
  const conf = confidenceScore(perf);
  // map confidence 0..1 to multiplier 0.5..1.5
  return 0.5 + conf;
}

/**
 * Determine if a model should be replaced by its fallback.
 * Returns true if performance is poor and we have enough data.
 */
export function shouldReplaceModel(perf: ModelPerformance, failures: number): boolean {
  if (failures > 2) return true;
  if (perf.totalBets < 5) return false;
  // If ROI < -0.3 (lost 30% of stakes) and at least 5 bets, consider replacement
  if (perf.roi < -0.3) return true;
  // If win rate < 20% and at least 10 bets
  if (perf.totalBets >= 10 && perf.won / perf.totalBets < 0.2) return true;
  return false;
}

export function updatePerformance(state: State, models: string[]): void {
  state.meta.performance = computeAllPerformances(state.bets, models);
}

export function getModelStakeMultiplier(state: State, model: string): number {
  const perf = state.meta.performance?.[model];
  if (!perf) return 1.0;
  return stakeRatioMultiplier(perf);
}