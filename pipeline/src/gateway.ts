import { generateText } from "ai";
import type { LLMFn } from "./bets";

// Plain model strings resolve through the Vercel AI Gateway when
// AI_GATEWAY_API_KEY is set in the environment.
export const callGateway: LLMFn = async (modelId, prompt) => {
  const { text } = await generateText({ model: modelId as any, prompt, temperature: 0.7, maxRetries: 3 });
  return text;
};
