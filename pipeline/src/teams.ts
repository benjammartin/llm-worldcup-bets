const ALIASES: Record<string, string> = Object.assign(Object.create(null), {
  "korea republic": "south korea",
  "korea dpr": "north korea",
  "usa": "united states",
  "united states of america": "united states",
  "ir iran": "iran",
  "cote d'ivoire": "ivory coast",
  "czechia": "czech republic",
  "turkiye": "turkey",
  "cabo verde": "cape verde",
  "china pr": "china",
  "bosnia-herzegovina": "bosnia and herzegovina",
  "bosnia & herzegovina": "bosnia and herzegovina",
});

export function normalizeTeam(name: string): string {
  const clean = name.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ALIASES[clean] ?? clean;
}

export function sameMatch(homeA: string, awayA: string, homeB: string, awayB: string): boolean {
  return normalizeTeam(homeA) === normalizeTeam(homeB)
    && normalizeTeam(awayA) === normalizeTeam(awayB);
}
