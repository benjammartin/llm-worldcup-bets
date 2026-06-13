import { describe, expect, test } from "bun:test";
import type { MatchOdds } from "../src/odds";
import { buildPrompt } from "../src/prompt";
import { formatFifaReportContext, parseFifaReportDetails, parseFifaReportHub } from "../src/fifa-reports";

const HUB_HTML = `
  <h2>Group A</h2>
  <a href="/media/native/tournaments/fifa-world-cup/2026/PMSR-M01 MEX V RSA.pdf" class="match-list-item" data-status="home">
    <span>MEX</span> Mexico <img alt="MEX" /> 2 - 0 <img alt="RSA" /> South Africa <span>RSA</span>
  </a>
  <a href="/media/native/tournaments/fifa-world-cup/2026/PMSR-M02 KOR V CZE .pdf" class="match-list-item" data-status="home">
    KOR Korea Republic 2 - 1 Czechia CZE
  </a>
  <a href="/not-a-report">Ignore me</a>
`;

const MATCHES: MatchOdds[] = [
  { matchId: "next-1", homeTeam: "Mexico", awayTeam: "Korea Republic", kickoff: "2026-06-15T16:00:00Z", odds: { home: 2.2, draw: 3.1, away: 3.3 } },
  { matchId: "next-2", homeTeam: "Brazil", awayTeam: "Spain", kickoff: "2026-06-15T19:00:00Z", odds: { home: 2.0, draw: 3.2, away: 3.8 } },
];

const PDF_TEXT = `
Mexico 2 - 0 South Africa
Group A - Match 1
11 June 2026
13:00 Kick Off
Mexico City Stadium
POST MATCH SUMMARY REPORT

Match Summary - Key Statistics
Mexico
South Africa
Possession
Total
57.1%
6.8%
36.1%
Total
2
Goals
0
1.78
xG (Expected Goals)
0.1
16 (4)
Attempts at Goal (On Target)
3 (2)
547 (495)
Total Passes (Complete)
351 (290)
90 %
Pass Completion %
83 %
105
Completed Line Breaks
57
10
Defensive Line Breaks
3
117
Receptions in the Final Third
36
13
Crosses
8
23
Ball Progressions
8
170 (26)
Defensive Pressures Applied (Direct Pressures)
306 (45)
31
Forced Turnovers
32
56
Second Balls
45
107.3 km
Total Distance Covered
97.1 km
`;

describe("FIFA post-match reports", () => {
  test("parses report links, teams, scorelines, and absolute PDF URLs from the hub", () => {
    const reports = parseFifaReportHub(HUB_HTML, "https://www.fifatrainingcentre.com/en/fifa-world-cup-2026/match-report-hub.php");

    expect(reports).toEqual([
      {
        matchNo: 1,
        homeTeam: "Mexico",
        awayTeam: "South Africa",
        homeScore: 2,
        awayScore: 0,
        pdfUrl: "https://www.fifatrainingcentre.com/media/native/tournaments/fifa-world-cup/2026/PMSR-M01%20MEX%20V%20RSA.pdf",
      },
      {
        matchNo: 2,
        homeTeam: "Korea Republic",
        awayTeam: "Czechia",
        homeScore: 2,
        awayScore: 1,
        pdfUrl: "https://www.fifatrainingcentre.com/media/native/tournaments/fifa-world-cup/2026/PMSR-M02%20KOR%20V%20CZE%20.pdf",
      },
    ]);
  });

  test("formats only official report context relevant to teams in the upcoming slate", () => {
    const context = formatFifaReportContext(MATCHES, parseFifaReportHub(HUB_HTML));

    expect(context).toContain("Official FIFA Training Centre post-match reports for teams in this slate:");
    expect(context).toContain("Mexico 2-0 South Africa");
    expect(context).toContain("Korea Republic 2-1 Czechia");
    expect(context).not.toContain("Brazil");
  });

  test("parses useful key statistics from the official PDF text", () => {
    expect(parseFifaReportDetails(PDF_TEXT)).toEqual({
      home: {
        goals: 2,
        xG: 1.78,
        shots: 16,
        shotsOnTarget: 4,
        possessionPct: 57.1,
        passesAttempted: 547,
        passesCompleted: 495,
        passCompletionPct: 90,
        completedLineBreaks: 105,
        finalThirdReceptions: 117,
        crosses: 13,
        ballProgressions: 23,
        defensivePressures: 170,
        directPressures: 26,
        forcedTurnovers: 31,
        totalDistanceKm: 107.3,
      },
      away: {
        goals: 0,
        xG: 0.1,
        shots: 3,
        shotsOnTarget: 2,
        possessionPct: 36.1,
        passesAttempted: 351,
        passesCompleted: 290,
        passCompletionPct: 83,
        completedLineBreaks: 57,
        finalThirdReceptions: 36,
        crosses: 8,
        ballProgressions: 8,
        defensivePressures: 306,
        directPressures: 45,
        forcedTurnovers: 32,
        totalDistanceKm: 97.1,
      },
    });
  });

  test("formats parsed report data instead of just PDF links when available", () => {
    const reports = parseFifaReportHub(HUB_HTML);
    reports[0].details = parseFifaReportDetails(PDF_TEXT);

    const context = formatFifaReportContext(MATCHES, reports);

    expect(context).toContain("Mexico 2-0 South Africa: xG 1.78-0.10, shots 16(4)-3(2), possession 57.1%-36.1%, final-third receptions 117-36");
    expect(context).toContain("line breaks 105-57, progressions 23-8, pressures 170(26)-306(45)");
  });

  test("buildPrompt includes official FIFA report context when provided", () => {
    const prompt = buildPrompt("ModelA", 10_000, 10_000, [], MATCHES, "Official FIFA context here");

    expect(prompt).toContain("Official FIFA context here");
    expect(prompt).toContain("Use it as qualitative context only; odds remain the primary probability signal.");
  });
});
