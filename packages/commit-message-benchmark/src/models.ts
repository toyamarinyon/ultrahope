import type { BenchmarkModelConfig } from "./types";

export const BENCHMARK_PROVIDER = "vercel-ai-gateway";

export const BENCHMARK_MODELS: BenchmarkModelConfig[] = [
	{
		id: "mistral/ministral-3b",
		tier: "small",
		label: "Ministral 3B",
	},
	{
		id: "xai/grok-code-fast-1",
		tier: "small",
		label: "Grok Code Fast",
	},
	{
		id: "cerebras/llama3.1-8b",
		tier: "small",
		label: "Llama 3.1 8B",
	},
	{
		id: "openai/gpt-5.2",
		tier: "frontier",
		label: "GPT-5.2",
	},
	{
		id: "anthropic/claude-opus-4.5",
		tier: "frontier",
		label: "Claude Opus 4.5",
	},
	{
		id: "google/gemini-3-pro-preview",
		tier: "frontier",
		label: "Gemini 3 Pro",
	},
];
