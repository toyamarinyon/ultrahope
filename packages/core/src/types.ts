export type Target = "vcs-commit-message" | "pr-title-body" | "pr-intent";

export interface LLMResponse {
	content: string;
	inputTokens: number;
	outputTokens: number;
	model: string;
}

export interface LLMProvider {
	name: string;
	complete(params: {
		system: string;
		userMessage: string;
		maxTokens?: number;
	}): Promise<LLMResponse>;
}
