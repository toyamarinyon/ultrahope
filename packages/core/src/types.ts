export type Target = "vcs-commit-message" | "pr-title-body" | "pr-intent";

export interface LLMResponse {
	content: string;
	vendor: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	cachedInputTokens?: number;
	cost?: number;
	generationId?: string;
}

export interface LLMMultiResponse {
	contents: string[];
	vendor: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	cachedInputTokens?: number;
	cost?: number;
	generationIds?: string[];
}

export interface ModelResult {
	model: string;
	content: string;
	inputTokens: number;
	outputTokens: number;
	cost?: number;
	generationId?: string;
}

export interface MultiModelResponse {
	results: ModelResult[];
	totalCost?: number;
}

export const DEFAULT_MODELS = [
	"mistral/mistral-nemo",
	"cerebras/llama-3.1-8b",
	"openai/gpt-5-nano",
	"xai/grok-code-fast-1",
] as const;

export type SupportedModel = (typeof DEFAULT_MODELS)[number];
