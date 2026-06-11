import { BASELINE_NAME, MODELS } from "./config";
import { bankroll, type State } from "./state";

const COLORS: Record<string, string> = Object.assign(Object.create(null), Object.fromEntries([
  ...MODELS.map((m) => [m.name, m.color]),
  [BASELINE_NAME, "#6b7280"],
]));

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function chartSVG(s: State, w = 1200, h = 630): string {
  const pad = { top: 70, right: 260, bottom: 30, left: 70 };
  const names = Object.keys(s.series);
  const all = names.flatMap((n) => s.series[n]);
  const ts = all.map((p) => new Date(p.t).getTime());
  const [t0, t1] = [Math.min(...ts), Math.max(...ts) || 1];
  const vals = all.map((p) => p.bankroll);
  const [v0, v1] = [Math.min(...vals, 9_000) * 0.95, Math.max(...vals, 11_000) * 1.05];
  const x = (t: number) => pad.left + ((t - t0) / Math.max(1, t1 - t0)) * (w - pad.left - pad.right);
  const y = (v: number) => h - pad.bottom - ((v - v0) / (v1 - v0)) * (h - pad.top - pad.bottom);

  const grid = [0.25, 0.5, 0.75].map((f) => {
    const v = v0 + f * (v1 - v0);
    return `<line x1="${pad.left}" y1="${y(v)}" x2="${w - pad.right}" y2="${y(v)}" stroke="#1f2937" stroke-width="1"/>
<text x="${pad.left - 8}" y="${y(v) + 4}" fill="#4b5563" font-size="13" text-anchor="end">${fmt(v)}</text>`;
  }).join("");

  const lines = names.map((n) => {
    const pts = s.series[n].map((p) => `${x(new Date(p.t).getTime())},${y(p.bankroll)}`).join(" ");
    const dash = n === BASELINE_NAME ? ` stroke-dasharray="6 5"` : "";
    return `<polyline points="${pts}" fill="none" stroke="${COLORS[n] ?? "#fff"}" stroke-width="2.5"${dash}/>`;
  }).join("");

  const labels = [...names].sort((a, b) => bankroll(s, b) - bankroll(s, a)).map((n, i) => {
    const ly = pad.top + i * 34;
    return `<rect x="${w - pad.right + 16}" y="${ly - 15}" width="220" height="26" rx="13" fill="${COLORS[n] ?? "#fff"}"/>
<text x="${w - pad.right + 28}" y="${ly + 3}" fill="#000" font-size="14" font-weight="bold">${n}  ${fmt(bankroll(s, n))}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="Space Mono, monospace">
<rect width="${w}" height="${h}" fill="#0a0a0a"/>
<text x="${pad.left}" y="40" fill="#f9fafb" font-size="22" font-weight="bold">LLM WORLD CUP BETS</text>
<text x="${pad.left}" y="60" fill="#6b7280" font-size="13">6 AIs · $10,000 each · every match of the World Cup</text>
${grid}${lines}${labels}
</svg>`;
}
