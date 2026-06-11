import { normalizeTeam } from "../../pipeline/src/teams";

const FLAGS: Record<string, string> = Object.assign(Object.create(null), {
  "albania": "🇦🇱", "algeria": "🇩🇿", "argentina": "🇦🇷", "australia": "🇦🇺",
  "austria": "🇦🇹", "belgium": "🇧🇪", "bolivia": "🇧🇴",
  "bosnia and herzegovina": "🇧🇦", "brazil": "🇧🇷", "burkina faso": "🇧🇫",
  "cameroon": "🇨🇲", "canada": "🇨🇦", "cape verde": "🇨🇻", "chile": "🇨🇱",
  "china": "🇨🇳", "colombia": "🇨🇴", "costa rica": "🇨🇷", "croatia": "🇭🇷",
  "curacao": "🇨🇼", "czech republic": "🇨🇿", "denmark": "🇩🇰",
  "dr congo": "🇨🇩", "congo dr": "🇨🇩", "ecuador": "🇪🇨", "egypt": "🇪🇬",
  "england": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "france": "🇫🇷", "georgia": "🇬🇪", "germany": "🇩🇪",
  "ghana": "🇬🇭", "greece": "🇬🇷", "haiti": "🇭🇹", "honduras": "🇭🇳",
  "hungary": "🇭🇺", "indonesia": "🇮🇩", "iran": "🇮🇷", "iraq": "🇮🇶",
  "italy": "🇮🇹", "ivory coast": "🇨🇮", "jamaica": "🇯🇲", "japan": "🇯🇵",
  "jordan": "🇯🇴", "mali": "🇲🇱", "mexico": "🇲🇽", "morocco": "🇲🇦",
  "netherlands": "🇳🇱", "new zealand": "🇳🇿", "nigeria": "🇳🇬",
  "north korea": "🇰🇵", "norway": "🇳🇴", "panama": "🇵🇦", "paraguay": "🇵🇾",
  "peru": "🇵🇪", "poland": "🇵🇱", "portugal": "🇵🇹", "qatar": "🇶🇦",
  "romania": "🇷🇴", "saudi arabia": "🇸🇦", "scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "senegal": "🇸🇳", "serbia": "🇷🇸", "slovakia": "🇸🇰", "slovenia": "🇸🇮",
  "south africa": "🇿🇦", "south korea": "🇰🇷", "spain": "🇪🇸",
  "sweden": "🇸🇪", "switzerland": "🇨🇭", "tunisia": "🇹🇳", "turkey": "🇹🇷",
  "ukraine": "🇺🇦", "united arab emirates": "🇦🇪", "united states": "🇺🇸",
  "uruguay": "🇺🇾", "uzbekistan": "🇺🇿", "venezuela": "🇻🇪", "wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
});

export function flagOf(team: string): string {
  return FLAGS[normalizeTeam(team)] ?? "🏳️";
}
