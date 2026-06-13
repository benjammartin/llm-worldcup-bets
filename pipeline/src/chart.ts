import { BASELINE_NAME, MODELS, STARTING_BANKROLL } from "./config";
import { bankroll, type Bet, type Pick3, type State } from "./state";

const COLORS: Record<string, string> = Object.assign(Object.create(null), Object.fromEntries([
  ...MODELS.map((m) => [m.name, m.color]),
  [BASELINE_NAME, "#6b7280"],
]));

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const signed = (n: number) => `${n >= 0 ? "+" : "-"}${fmt(Math.abs(n))}`;
const xml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]!));

export interface ChartOpts {
  compact?: boolean; // no pills/title, larger fonts — for small viewports
  og?: boolean; // social preview card: large, cropped-safe summary instead of dense chart
}

function pickText(pick: Bet["pick"], b: Bet): string {
  return pick === "draw" ? "Draw" : pick === "home" ? b.homeTeam : b.awayTeam;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function linePath(s: State, names: string[], w: number, h: number, pad: { top: number; right: number; bottom: number; left: number }): string {
  const rawTs = names.flatMap((n) => s.series[n]).map((p) => new Date(p.t).getTime());
  const t0 = Math.min(...rawTs);
  const t1 = Math.max(Math.max(...rawTs), t0 + 3600_000);
  const extended = Object.fromEntries(names.map((n) => {
    const pts = s.series[n].map((p) => ({ t: new Date(p.t).getTime(), bankroll: p.bankroll }));
    const last = pts[pts.length - 1];
    if (last.t < t1) pts.push({ t: t1, bankroll: last.bankroll });
    return [n, pts];
  }));
  const vals = names.flatMap((n) => extended[n].map((p) => p.bankroll));
  const v0 = Math.min(...vals, 9_000) * 0.95;
  const v1 = Math.max(...vals, 11_000) * 1.05;
  const x = (t: number) => pad.left + ((t - t0) / Math.max(1, t1 - t0)) * (w - pad.left - pad.right);
  const y = (v: number) => h - pad.bottom - ((v - v0) / (v1 - v0)) * (h - pad.top - pad.bottom);

  return names.map((n) => {
    const pts = extended[n].map((p) => `${x(p.t)},${y(p.bankroll)}`).join(" ");
    const dash = n === BASELINE_NAME ? ` stroke-dasharray="7 7" opacity="0.7"` : "";
    return `<polyline points="${pts}" fill="none" stroke="${COLORS[n] ?? "#fff"}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"${dash}/>`;
  }).join("");
}

function ogSVG(s: State, w: number, h: number): string {
  const names = Object.keys(s.series);
  const standings = [...names]
    .sort((a, b) => bankroll(s, b) - bankroll(s, a))
    .map((name) => ({ name, roll: bankroll(s, name), delta: bankroll(s, name) - STARTING_BANKROLL }));
  const leader = standings[0];
  const pending = s.bets.filter((b) => b.status === "pending").sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const matchIds = new Set(pending.map((b) => b.matchId));
  const totalPending = pending.reduce((sum, b) => sum + b.stake, 0);
  const byModel = new Map<string, number>();
  for (const b of pending) byModel.set(b.model, (byModel.get(b.model) ?? 0) + b.stake);
  const topExposure = [...byModel.entries()].sort((a, b) => b[1] - a[1])[0];
  const headlineMatch = pending[0];
  const headlineBets = headlineMatch ? pending.filter((b) => b.matchId === headlineMatch.matchId) : [];
  const counts = { home: 0, draw: 0, away: 0 } as Record<Pick3, number>;
  for (const b of headlineBets) counts[b.pick] += 1;
  const topPick = (Object.entries(counts) as [Pick3, number][]).sort((a, b) => b[1] - a[1])[0];
  const biggestLoss = [...s.bets.filter((b) => b.status === "lost" && b.model !== BASELINE_NAME)].sort((a, b) => b.stake - a.stake)[0];
  const biggestPending = [...pending.filter((b) => b.model !== BASELINE_NAME)].sort((a, b) => b.stake - a.stake)[0];
  const thumbnailBet = biggestLoss ?? biggestPending;
  const mainHeadline = thumbnailBet
    ? biggestLoss
      ? `${thumbnailBet.model} JUST LOST ${fmt(thumbnailBet.stake)}`
      : `${thumbnailBet.model} BET ${fmt(thumbnailBet.stake)} ON ${pickText(thumbnailBet.pick, thumbnailBet).toUpperCase()}`
    : "6 AIs ARE BETTING $10,000";
  const subHeadline = headlineMatch && topPick?.[1]
    ? `${headlineMatch.homeTeam} vs ${headlineMatch.awayTeam} · ${topPick[1]}/${headlineBets.length} pick ${pickText(topPick[0], headlineMatch)}`
    : "Watch them bet, panic, and go broke";

  const rows = standings.slice(0, 4).map((r, i) => {
    const y = 386 + i * 30;
    const color = COLORS[r.name] ?? "#fff";
    const deltaColor = r.delta >= 0 ? "#22c55e" : "#ef4444";
    return `<g>
      <text x="624" y="${y}" fill="#6b7280" font-size="22" font-weight="700">${i + 1}</text>
      <circle cx="670" cy="${y - 7}" r="10" fill="${color}"/>
      <text x="694" y="${y}" fill="#f9fafb" font-size="30" font-weight="700">${xml(r.name)}</text>
      <text x="982" y="${y}" fill="#f9fafb" font-size="30" font-weight="700" text-anchor="end">${fmt(r.roll)}</text>
      <text x="1012" y="${y}" fill="${deltaColor}" font-size="20" font-weight="700">${signed(r.delta)}</text>
    </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Space Mono, monospace">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22070a"/>
      <stop offset="0.46" stop-color="#050607"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="28" y="24" width="1144" height="582" rx="34" fill="rgba(5,6,7,.72)" stroke="#f59e0b" stroke-width="3"/>
  <text x="70" y="88" fill="#f59e0b" font-size="26" font-weight="800" letter-spacing="4">AI WORLD CUP BETS</text>
  <text x="70" y="166" fill="#f9fafb" font-size="58" font-weight="900">${xml(truncate(mainHeadline, 34))}</text>
  <text x="70" y="220" fill="#f9fafb" font-size="38" font-weight="800">6 AIs · $10,000 each · one World Cup</text>
  <text x="70" y="260" fill="#8b949e" font-size="24">${xml(truncate(subHeadline, 70))}</text>

  <rect x="70" y="306" width="470" height="170" rx="24" fill="#111827" stroke="#263241"/>
  <text x="104" y="356" fill="#8b949e" font-size="20" font-weight="800">CURRENT CARNAGE</text>
  <text x="104" y="410" fill="#f9fafb" font-size="42" font-weight="900">${xml(fmt(totalPending))} exposed</text>
  <text x="104" y="450" fill="#f59e0b" font-size="25" font-weight="800">${matchIds.size} matches · ${pending.length} live bets</text>

  <rect x="590" y="306" width="510" height="170" rx="24" fill="#0a0a0a" stroke="#1c2128"/>
  <text x="624" y="356" fill="#8b949e" font-size="20" font-weight="800">LEADERBOARD SNAPSHOT</text>
  <g>${rows}</g>

  <text x="70" y="548" fill="#f59e0b" font-size="24" font-weight="800">If your favorite AI can’t beat an if-statement, should it run your company?</text>
  <text x="70" y="582" fill="#555e6a" font-size="20">llmworldcup.xyz</text>
</svg>`;
}

export function chartSVG(s: State, w = 1200, h = 630, opts: ChartOpts = {}): string {
  if (opts.og) return ogSVG(s, w, h);

  const compact = opts.compact ?? false;
  const fs = compact ? 1.7 : 1;
  const pad = compact
    ? { top: 24, right: 30, bottom: 36, left: 96 }
    : { top: 70, right: 260, bottom: 30, left: 70 };
  const names = Object.keys(s.series);
  const rawTs = names.flatMap((n) => s.series[n]).map((p) => new Date(p.t).getTime());
  const t0 = Math.min(...rawTs);
  // extend the time domain so single-point (day 1) series still draw a visible flat line
  const t1 = Math.max(Math.max(...rawTs), t0 + 3600_000);
  const extended: Record<string, { t: number; bankroll: number }[]> = Object.fromEntries(
    names.map((n) => {
      const pts = s.series[n].map((p) => ({ t: new Date(p.t).getTime(), bankroll: p.bankroll }));
      const last = pts[pts.length - 1];
      if (last.t < t1) pts.push({ t: t1, bankroll: last.bankroll });
      return [n, pts];
    }),
  );
  const all = names.flatMap((n) => extended[n]);
  const vals = all.map((p) => p.bankroll);
  const [v0, v1] = [Math.min(...vals, 9_000) * 0.95, Math.max(...vals, 11_000) * 1.05];
  const x = (t: number) => pad.left + ((t - t0) / Math.max(1, t1 - t0)) * (w - pad.left - pad.right);
  const y = (v: number) => h - pad.bottom - ((v - v0) / (v1 - v0)) * (h - pad.top - pad.bottom);
  const allBankrollsEqual = new Set(vals).size === 1;
  const tieLane = (n: string) => {
    if (!allBankrollsEqual || names.length <= 1) return 0;
    const i = names.indexOf(n);
    const gap = compact ? 7 : 5;
    return (i - (names.length - 1) / 2) * gap;
  };

  const grid = [0.25, 0.5, 0.75].map((f) => {
    const v = v0 + f * (v1 - v0);
    return `<line x1="${pad.left}" y1="${y(v)}" x2="${w - pad.right}" y2="${y(v)}" stroke="#1f2937" stroke-width="1"/>
<text x="${pad.left - 8}" y="${y(v) + 4}" fill="#4b5563" font-size="${13 * fs}" text-anchor="end">${fmt(v)}</text>`;
  }).join("");

  const lines = names.map((n) => {
    const lane = tieLane(n);
    const pts = extended[n].map((p) => `${x(p.t)},${y(p.bankroll) + lane}`).join(" ");
    const dash = n === BASELINE_NAME ? ` stroke-dasharray="6 5"` : "";
    return `<polyline points="${pts}" fill="none" stroke="${COLORS[n] ?? "#fff"}" stroke-width="2.5"${dash}/>`;
  }).join("");

  const labels = compact ? "" : [...names].sort((a, b) => bankroll(s, b) - bankroll(s, a)).map((n, i) => {
    const ly = pad.top + i * 34;
    return `<rect x="${w - pad.right + 16}" y="${ly - 15}" width="220" height="26" rx="13" fill="${COLORS[n] ?? "#fff"}"/>
<text x="${w - pad.right + 28}" y="${ly + 3}" fill="#000" font-size="14" font-weight="bold">${n}  ${fmt(bankroll(s, n))}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Space Mono, monospace">
<rect width="${w}" height="${h}" fill="#0a0a0a"/>
${compact ? "" : `<text x="${pad.left}" y="40" fill="#f9fafb" font-size="22" font-weight="bold">LLM WORLD CUP BETS</text>
<text x="${pad.left}" y="60" fill="#6b7280" font-size="13">6 AIs · $10,000 each · every match of the World Cup</text>`}
${grid}${lines}${labels}
</svg>`;
}
