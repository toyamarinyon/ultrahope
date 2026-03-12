export type ModelTier = "default" | "pro";

export type ModelMetadata = {
	id: string;
	provider: string;
	providerUrl: string;
	tier: ModelTier;
};

export const ALLOWED_MODELS: readonly ModelMetadata[] = [
	{
		id: "mistral/ministral-3b",
		provider: "Mistral AI",
		providerUrl: "https://mistral.ai",
		tier: "default",
	},
	{
		id: "xai/grok-code-fast-1",
		provider: "xAI",
		providerUrl: "https://x.ai",
		tier: "default",
	},
	{
		id: "anthropic/claude-sonnet-4.6",
		provider: "Anthropic",
		providerUrl: "https://anthropic.com",
		tier: "pro",
	},
	{
		id: "openai/gpt-5.3-codex",
		provider: "OpenAI",
		providerUrl: "https://openai.com",
		tier: "pro",
	},
] as const;

export const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map((m) => m.id);

const ALLOWED_MODEL_ID_SET = new Set<string>(ALLOWED_MODEL_IDS);

export function isAllowedModelId(model: string): boolean {
	return ALLOWED_MODEL_ID_SET.has(model);
}

export function getModelTier(model: string): ModelTier | undefined {
	return ALLOWED_MODELS.find((entry) => entry.id === model)?.tier;
}
