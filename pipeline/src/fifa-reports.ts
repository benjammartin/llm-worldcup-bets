import type { MatchOdds } from "./odds";
import { normalizeTeam } from "./teams";

export const FIFA_REPORT_HUB_URL = "https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub.php";

export interface FifaReport {
  matchNo: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  pdfUrl: string;
}

const FIFA_HOST = "https://www.fifatrainingcentre.com";
const TEAM_CODE_RE = /^[A-Z]{3}$/;

export async function fetchFifaReports(
  fetchFn: typeof fetch = fetch,
  hubUrl = FIFA_REPORT_HUB_URL,
): Promise<FifaReport[]> {
  const res = await fetchFn(hubUrl, { headers: { "user-agent": "llm-worldcup-bets/1.0" } });
  if (!res.ok) throw new Error(`FIFA report hub returned ${res.status}`);
  return parseFifaReportHub(await res.text(), hubUrl);
}

export function parseFifaReportHub(html: string, hubUrl = FIFA_REPORT_HUB_URL): FifaReport[] {
  const reports: FifaReport[] = [];
  const anchorRe = /<a\b[^>]*href=["']([^"']+\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html))) {
    const href = decodeHtml(match[1]);
    const text = normalizeText(stripTags(match[2]));
    const parsed = parseReportText(text);
    const matchNo = parseMatchNo(href);
    if (!parsed || !matchNo) continue;
    reports.push({ matchNo, ...parsed, pdfUrl: absolutePdfUrl(href, hubUrl) });
  }
  return reports;
}

export function formatFifaReportContext(matches: MatchOdds[], reports: FifaReport[]): string {
  const slateTeams = new Set(matches.flatMap((m) => [normalizeTeam(m.homeTeam), normalizeTeam(m.awayTeam)]));
  const relevant = reports
    .filter((r) => slateTeams.has(normalizeTeam(r.homeTeam)) || slateTeams.has(normalizeTeam(r.awayTeam)))
    .sort((a, b) => a.matchNo - b.matchNo);

  if (relevant.length === 0) return "";

  const lines = relevant.map((r) =>
    `- M${String(r.matchNo).padStart(2, "0")}: ${r.homeTeam} ${r.homeScore}-${r.awayScore} ${r.awayTeam} — official post-match report: ${r.pdfUrl}`,
  );
  return [
    "Official FIFA Training Centre post-match reports for teams in this slate:",
    ...lines,
  ].join("\n");
}

function parseReportText(text: string): Omit<FifaReport, "matchNo" | "pdfUrl"> | null {
  const tokens = text.split(" ").filter(Boolean);
  const scoreIndex = tokens.findIndex((token, i) => /^\d+$/.test(token) && tokens[i + 1] === "-" && /^\d+$/.test(tokens[i + 2] ?? ""));
  if (scoreIndex <= 1) return null;

  const homeScore = Number(tokens[scoreIndex]);
  const awayScore = Number(tokens[scoreIndex + 2]);
  const homeTokens = dropBoundaryTeamCode(tokens.slice(0, scoreIndex), "start");
  const awayTokens = dropBoundaryTeamCode(tokens.slice(scoreIndex + 3), "end");
  if (homeTokens.length === 0 || awayTokens.length === 0) return null;

  return {
    homeTeam: homeTokens.join(" "),
    awayTeam: awayTokens.join(" "),
    homeScore,
    awayScore,
  };
}

function dropBoundaryTeamCode(tokens: string[], side: "start" | "end"): string[] {
  const copy = [...tokens];
  if (side === "start" && TEAM_CODE_RE.test(copy[0] ?? "")) copy.shift();
  if (side === "end" && TEAM_CODE_RE.test(copy[copy.length - 1] ?? "")) copy.pop();
  return copy;
}

function parseMatchNo(href: string): number | null {
  const m = href.match(/PMSR-M(\d+)/i);
  return m ? Number(m[1]) : null;
}

function absolutePdfUrl(href: string, hubUrl: string): string {
  const url = href.startsWith("http") ? new URL(href) : new URL(href, href.startsWith("/") ? FIFA_HOST : hubUrl);
  return url.toString();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}

function normalizeText(s: string): string {
  return decodeHtml(s).replace(/\s+/g, " ").trim();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8209;/g, "‑")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
