export const ALLOWED_MODELS = [
	{
		id: "mistral/ministral-3b",
		provider: "Mistral AI",
		providerUrl: "https://mistral.ai",
	},
	{
		id: "xai/grok-code-fast-1",
		provider: "xAI",
		providerUrl: "https://x.ai",
	},
] as const;

export const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map((m) => m.id);

const ALLOWED_MODEL_ID_SET = new Set<string>(ALLOWED_MODEL_IDS);

export function isAllowedModelId(model: string): boolean {
	return ALLOWED_MODEL_ID_SET.has(model);
}
