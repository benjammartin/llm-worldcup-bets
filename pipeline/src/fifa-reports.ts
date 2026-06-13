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
  details?: FifaReportDetails;
}

export interface FifaTeamReportStats {
  goals: number;
  xG: number;
  shots: number;
  shotsOnTarget: number;
  possessionPct: number;
  passesAttempted: number;
  passesCompleted: number;
  passCompletionPct: number;
  completedLineBreaks: number;
  finalThirdReceptions: number;
  crosses: number;
  ballProgressions: number;
  defensivePressures: number;
  directPressures: number;
  forcedTurnovers: number;
  totalDistanceKm: number;
}

export interface FifaReportDetails {
  home: FifaTeamReportStats;
  away: FifaTeamReportStats;
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

export async function fetchFifaReportDetails(
  report: FifaReport,
  fetchFn: typeof fetch = fetch,
): Promise<FifaReportDetails> {
  const res = await fetchFn(report.pdfUrl, { headers: { "user-agent": "llm-worldcup-bets/1.0" } });
  if (!res.ok) throw new Error(`FIFA report PDF returned ${res.status}`);
  const text = await extractPdfText(Buffer.from(await res.arrayBuffer()));
  return parseFifaReportDetails(text);
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

export function parseFifaReportDetails(text: string): FifaReportDetails {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\u0000/g, "").trim()).filter(Boolean);

  return {
    home: {
      goals: numericBefore(lines, "Goals"),
      xG: numericBefore(lines, "xG (Expected Goals)"),
      ...attemptsBefore(lines, "Attempts at Goal (On Target)"),
      possessionPct: possession(lines).home,
      ...passesBefore(lines, "Total Passes (Complete)"),
      passCompletionPct: numericBefore(lines, "Pass Completion %"),
      completedLineBreaks: numericBefore(lines, "Completed Line Breaks"),
      finalThirdReceptions: numericBefore(lines, "Receptions in the Final Third"),
      crosses: numericBefore(lines, "Crosses"),
      ballProgressions: numericBefore(lines, "Ball Progressions"),
      ...pressuresBefore(lines, "Defensive Pressures Applied (Direct Pressures)"),
      forcedTurnovers: numericBefore(lines, "Forced Turnovers"),
      totalDistanceKm: numericBefore(lines, "Total Distance Covered"),
    },
    away: {
      goals: numericAfter(lines, "Goals"),
      xG: numericAfter(lines, "xG (Expected Goals)"),
      ...attemptsAfter(lines, "Attempts at Goal (On Target)"),
      possessionPct: possession(lines).away,
      ...passesAfter(lines, "Total Passes (Complete)"),
      passCompletionPct: numericAfter(lines, "Pass Completion %"),
      completedLineBreaks: numericAfter(lines, "Completed Line Breaks"),
      finalThirdReceptions: numericAfter(lines, "Receptions in the Final Third"),
      crosses: numericAfter(lines, "Crosses"),
      ballProgressions: numericAfter(lines, "Ball Progressions"),
      ...pressuresAfter(lines, "Defensive Pressures Applied (Direct Pressures)"),
      forcedTurnovers: numericAfter(lines, "Forced Turnovers"),
      totalDistanceKm: numericAfter(lines, "Total Distance Covered"),
    },
  };
}

export function formatFifaReportContext(matches: MatchOdds[], reports: FifaReport[]): string {
  const slateTeams = new Set(matches.flatMap((m) => [normalizeTeam(m.homeTeam), normalizeTeam(m.awayTeam)]));
  const relevant = reports
    .filter((r) => slateTeams.has(normalizeTeam(r.homeTeam)) || slateTeams.has(normalizeTeam(r.awayTeam)))
    .sort((a, b) => a.matchNo - b.matchNo);

  if (relevant.length === 0) return "";

  const lines = relevant.map((r) => `- M${String(r.matchNo).padStart(2, "0")}: ${formatReportLine(r)}`);
  return [
    "Official FIFA Training Centre post-match reports for teams in this slate:",
    ...lines,
  ].join("\n");
}

function formatReportLine(r: FifaReport): string {
  if (!r.details) return `${r.homeTeam} ${r.homeScore}-${r.awayScore} ${r.awayTeam} — official post-match report: ${r.pdfUrl}`;
  const h = r.details.home;
  const a = r.details.away;
  return `${r.homeTeam} ${r.homeScore}-${r.awayScore} ${r.awayTeam}: xG ${h.xG.toFixed(2)}-${a.xG.toFixed(2)}, shots ${h.shots}(${h.shotsOnTarget})-${a.shots}(${a.shotsOnTarget}), possession ${h.possessionPct.toFixed(1)}%-${a.possessionPct.toFixed(1)}%, final-third receptions ${h.finalThirdReceptions}-${a.finalThirdReceptions}, line breaks ${h.completedLineBreaks}-${a.completedLineBreaks}, progressions ${h.ballProgressions}-${a.ballProgressions}, pressures ${h.defensivePressures}(${h.directPressures})-${a.defensivePressures}(${a.directPressures}). Report: ${r.pdfUrl}`;
}

async function extractPdfText(data: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function parseReportText(text: string): Omit<FifaReport, "matchNo" | "pdfUrl" | "details"> | null {
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

function numericBefore(lines: string[], label: string): number {
  const { line, index } = findLabelLine(lines, label);
  return parseNumber(line === label ? lines[index - 1] : sideOfLabel(line, label, "before"));
}

function numericAfter(lines: string[], label: string): number {
  const { line, index } = findLabelLine(lines, label);
  return parseNumber(line === label ? lines[index + 1] : sideOfLabel(line, label, "after"));
}

function attemptsBefore(lines: string[], label: string): Pick<FifaTeamReportStats, "shots" | "shotsOnTarget"> {
  const { line, index } = findLabelLine(lines, label);
  const parsed = parseNumberPair(line === label ? lines[index - 1] : sideOfLabel(line, label, "before"));
  return { shots: parsed.total, shotsOnTarget: parsed.inner };
}

function attemptsAfter(lines: string[], label: string): Pick<FifaTeamReportStats, "shots" | "shotsOnTarget"> {
  const { line, index } = findLabelLine(lines, label);
  const parsed = parseNumberPair(line === label ? lines[index + 1] : sideOfLabel(line, label, "after"));
  return { shots: parsed.total, shotsOnTarget: parsed.inner };
}

function passesBefore(lines: string[], label: string): Pick<FifaTeamReportStats, "passesAttempted" | "passesCompleted"> {
  const { line, index } = findLabelLine(lines, label);
  const parsed = parseNumberPair(line === label ? lines[index - 1] : sideOfLabel(line, label, "before"));
  return { passesAttempted: parsed.total, passesCompleted: parsed.inner };
}

function passesAfter(lines: string[], label: string): Pick<FifaTeamReportStats, "passesAttempted" | "passesCompleted"> {
  const { line, index } = findLabelLine(lines, label);
  const parsed = parseNumberPair(line === label ? lines[index + 1] : sideOfLabel(line, label, "after"));
  return { passesAttempted: parsed.total, passesCompleted: parsed.inner };
}

function pressuresBefore(lines: string[], label: string): Pick<FifaTeamReportStats, "defensivePressures" | "directPressures"> {
  const { line, index } = findLabelLine(lines, label);
  const parsed = parseNumberPair(line === label ? lines[index - 1] : sideOfLabel(line, label, "before"));
  return { defensivePressures: parsed.total, directPressures: parsed.inner };
}

function pressuresAfter(lines: string[], label: string): Pick<FifaTeamReportStats, "defensivePressures" | "directPressures"> {
  const { line, index } = findLabelLine(lines, label);
  const parsed = parseNumberPair(line === label ? lines[index + 1] : sideOfLabel(line, label, "after"));
  return { defensivePressures: parsed.total, directPressures: parsed.inner };
}

function possession(lines: string[]): { home: number; away: number } {
  const i = findLabelLine(lines, "Possession").index;
  const values = lines.slice(i + 1, i + 8).flatMap((line) => parseNumbers(line));
  if (values.length < 3) throw new Error("Could not parse possession values");
  return { home: values[0], away: values[2] };
}

function findLabelLine(lines: string[], label: string): { line: string; index: number } {
  const index = lines.findIndex((line) => line === label || line.includes(label));
  if (index === -1) throw new Error(`Missing FIFA report label: ${label}`);
  return { line: lines[index], index };
}

function sideOfLabel(line: string, label: string, side: "before" | "after"): string {
  const [before, after = ""] = line.split(label);
  return side === "before" ? before : after;
}

function parseNumberPair(s: string): { total: number; inner: number } {
  const m = s.match(/([\d.]+)\s*\(([\d.]+)\)/);
  if (!m) throw new Error(`Could not parse number pair: ${s}`);
  return { total: Number(m[1]), inner: Number(m[2]) };
}

function parseNumber(s: string): number {
  const n = parseMaybeNumber(s);
  if (n === null) throw new Error(`Could not parse number: ${s}`);
  return n;
}

function parseNumbers(s: string): number[] {
  return [...(s?.matchAll(/[\d.]+/g) ?? [])].map((m) => Number(m[0]));
}

function parseMaybeNumber(s: string): number | null {
  const m = s?.match(/[\d.]+/);
  return m ? Number(m[0]) : null;
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
