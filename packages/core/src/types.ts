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
