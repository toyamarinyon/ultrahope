import type { GatewayModelId } from "ai";
export type Target = "vcs-commit-message" | "pr-title-body" | "pr-intent";

export type LanguageModel = GatewayModelId | "mocking";

export interface LLMResponse {
	content: string;
	vendor: string;
	model: LanguageModel;
	inputTokens: number;
	outputTokens: number;
	cachedInputTokens?: number;
	cost?: number;
	generationId?: string;
}
