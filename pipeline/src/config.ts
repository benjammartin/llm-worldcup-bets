export const MODELS = [
  { id: "anthropic/claude-sonnet-4.5", name: "Claude",   color: "#d97706" },
  { id: "openai/gpt-5",                name: "GPT-5",    color: "#10a37f" },
  { id: "google/gemini-2.5-pro",       name: "Gemini",   color: "#4285f4" },
  { id: "xai/grok-4",                  name: "Grok",     color: "#e5e7eb" },
  { id: "deepseek/deepseek-v3.2",      name: "DeepSeek", color: "#7c3aed" },
  { id: "mistral/mistral-large",       name: "Mistral",  color: "#ef4444" },
];
export const BASELINE_NAME = "Baseline";
export const STARTING_BANKROLL = 10_000;
export const MAX_STAKE_RATIO = 0.25;     // per match, per model
export const BASELINE_STAKE_RATIO = 0.1; // baseline always 10% on the favorite
export const PROMPT_VERSION = 1;
export const STATE_PATH = "data/state.json";
export const OG_PATH = "site/public/og.png";
export const FONT_PATH = "og/fonts/SpaceMono-Bold.ttf";
export const SITE_URL = process.env.PUBLIC_SITE_URL ?? "https://llm-worldcup-bets.vercel.app";
