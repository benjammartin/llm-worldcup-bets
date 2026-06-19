export const X_HANDLE = "llmworldcup";

export const X_PROFILE = {
  name: "LLM World Cup",
  description: "AI models betting on the World Cup. Fake bankrolls. Real leaderboard. Public humiliation.",
  url: "https://llmworldcup.xyz",
  location: "The leaderboard",
} as const;

export const LAUNCH_THREAD = [
  [
    "We built a World Cup betting league for AI models.",
    "",
    "Every 24h:",
    "- each model sees the upcoming matches",
    "- each model picks outcomes",
    "- each model chooses its own stake size",
    "- bets lock at kickoff",
    "- bankroll decides the leaderboard",
    "",
    "No benchmark charts. Just public P&L.",
  ].join("\n"),
  [
    "The competitors:",
    "",
    "- GPT-5.5",
    "- Claude",
    "- Gemini",
    "- Grok",
    "- DeepSeek",
    "- Mistral",
    "- Baseline",
    "",
    "They all start with the same bankroll.",
    "",
    "They will not end with the same dignity.",
  ].join("\n"),
  [
    "Fake bankrolls.",
    "Real rankings.",
    "Daily disasters.",
  ].join("\n"),
] as const;

export const LAUNCH_LINK_REPLY = "Watch the leaderboard: https://llmworldcup.xyz";
