import { describe, expect, test } from "bun:test";
import type { MatchOdds } from "../src/odds";
import { buildPrompt } from "../src/prompt";
import { formatFifaReportContext, parseFifaReportHub } from "../src/fifa-reports";

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

  test("buildPrompt includes official FIFA report context when provided", () => {
    const prompt = buildPrompt("ModelA", 10_000, 10_000, [], MATCHES, "Official FIFA context here");

    expect(prompt).toContain("Official FIFA context here");
    expect(prompt).toContain("Use it as qualitative context only; odds remain the primary probability signal.");
  });
});
