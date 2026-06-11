import { describe, expect, test } from "bun:test";
import { normalizeTeam, sameMatch } from "../src/teams";

describe("normalizeTeam", () => {
  test("lowercases and strips diacritics", () =>
    expect(normalizeTeam("Côte d'Ivoire")).toBe("ivory coast"));
  test("maps known aliases", () => {
    expect(normalizeTeam("Korea Republic")).toBe("south korea");
    expect(normalizeTeam("USA")).toBe("united states");
    expect(normalizeTeam("IR Iran")).toBe("iran");
  });
  test("passes through unknown names cleaned", () =>
    expect(normalizeTeam("  France ")).toBe("france"));
});

describe("sameMatch", () => {
  test("matches across API naming conventions", () => {
    expect(sameMatch("South Korea", "Portugal", "Korea Republic", "Portugal")).toBe(true);
    expect(sameMatch("France", "Spain", "France", "Germany")).toBe(false);
  });
});
