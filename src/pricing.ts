// Approximate pricing per 1M tokens (prompt/completion)
// These are estimates based on OpenRouter pricing - actual prices may vary
const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'moonshotai/kimi-k2': { prompt: 0.5, completion: 0.5 },
  'google/gemini-2.5-flash': { prompt: 0.075, completion: 0.3 },
  'z-ai/glm-4.7': { prompt: 0.1, completion: 0.1 },
};

export function calculateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[modelId] || { prompt: 0.1, completion: 0.1 };
  
  const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
  const completionCost = (completionTokens / 1_000_000) * pricing.completion;
  
  return promptCost + completionCost;
}

export function formatCost(cost: number): string {
  if (cost < 0.0001) {
    return `$${(cost * 1000).toFixed(4)}`;
  }
  return `$${cost.toFixed(6)}`;
}
