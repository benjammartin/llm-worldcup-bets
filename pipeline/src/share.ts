import type { Bet } from "./state";
import { flagOf } from "../../site/src/flags";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pickText = (pick: Bet["pick"], b: Bet) =>
  pick === "draw" ? "Draw" : pick === "home" ? b.homeTeam : b.awayTeam;

export const byMatch = (bets: Bet[]): Bet[][] => {
  const m = new Map<string, Bet[]>();
  for (const b of bets) m.set(b.matchId, [...(m.get(b.matchId) ?? []), b]);
  return [...m.values()];
};

function topPick(bets: Bet[]): { pick: Bet["pick"]; label: string; count: number } {
  const counts = { home: 0, draw: 0, away: 0 } as Record<Bet["pick"], number>;
  for (const b of bets) counts[b.pick] += 1;
  const [pick, count] = (Object.entries(counts) as [Bet["pick"], number][])
    .sort((a, b) => b[1] - a[1])[0];
  return { pick, count, label: pickText(pick, bets[0]) };
}

export function biggestBet(bets: Bet[]): Bet {
  return [...bets].sort((a, b) => b.stake - a.stake || a.model.localeCompare(b.model))[0];
}

export function composeMatchShare(bets: Bet[], siteUrl: string): string {
  const top = topPick(bets);
  const exposed = bets.reduce((sum, b) => sum + b.stake, 0);
  const biggest = biggestBet(bets);
  return [
    `${bets[0].homeTeam} vs ${bets[0].awayTeam}`,
    "",
    `${top.count}/${bets.length} AIs picked ${top.label}.`,
    `Total exposed: ${money(exposed)}.`,
    `Most reckless: ${biggest.model}, ${money(biggest.stake)}.`,
    "",
    top.count === bets.length ? "Consensus or collective hallucination?" : "Split decision or distributed confusion?",
    "",
    siteUrl,
  ].join("\n");
}

export function composeCycleShare(bets: Bet[], siteUrl?: string, maxLength = 280): string {
  const matches = byMatch(bets).sort((a, b) => a[0].kickoff.localeCompare(b[0].kickoff));
  const blocks = matches.map((matchBets) => {
    const b = matchBets[0];
    const top = topPick(matchBets);
    const biggest = biggestBet(matchBets);
    return [
      `${flagOf(b.homeTeam)} ${b.homeTeam} v ${b.awayTeam} ${flagOf(b.awayTeam)}`,
      `${top.count}/${matchBets.length} picked ${top.label} · Biggest: ${biggest.model} ${money(biggest.stake)}`,
    ].join("\n");
  });

  const header = "Today’s AI World Cup bets:";
  const withBlocks = (n: number, includeUrl: boolean) => [
    header,
    "",
    ...blocks.slice(0, n).flatMap((block) => [block, ""]),
    ...(n < blocks.length ? [`+${blocks.length - n} more match${blocks.length - n > 1 ? "es" : ""} on the site`, ""] : []),
    ...(includeUrl && siteUrl ? [siteUrl] : []),
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();

  for (let includeUrl of [true, false]) {
    for (let n = blocks.length; n >= 1; n--) {
      const text = withBlocks(n, includeUrl);
      if (n === blocks.length && text.length <= maxLength) return text;
    }
  }

  const compactBlocks = matches.map((matchBets) => {
    const b = matchBets[0];
    const top = topPick(matchBets);
    const biggest = biggestBet(matchBets);
    return `${b.homeTeam} v ${b.awayTeam} — ${top.count}/${matchBets.length} ${top.label} · max ${biggest.model} ${money(biggest.stake)}`;
  });
  const compact = [header, ...compactBlocks, siteUrl?.replace(/^https?:\/\//, "")].filter(Boolean).join("\n");
  if (compact.length <= maxLength) return compact;

  for (let includeUrl of [true, false]) {
    for (let n = blocks.length - 1; n >= 1; n--) {
      const text = withBlocks(n, includeUrl);
      if (text.length <= maxLength) return text;
    }
  }
  return compact.slice(0, maxLength - 1).trimEnd() + "…";
}
