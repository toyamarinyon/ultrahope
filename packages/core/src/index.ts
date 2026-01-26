import { generateText } from "ai";
import { PROMPTS } from "./prompts";
import type { LLMResponse, Target } from "./types";

export type { LLMResponse, Target };
export { PROMPTS } from "./prompts";

const PRIMARY_MODEL = "cerebras/llama-3.1-8b";
const FALLBACK_MODELS = ["openai/gpt-5-nano"];

export async function translate(
	input: string,
	target: Target,
): Promise<LLMResponse> {
	const result = await generateText({
		model: PRIMARY_MODEL,
		system: PROMPTS[target],
		prompt: input,
		maxOutputTokens: 1024,
		providerOptions: {
			gateway: {
				models: FALLBACK_MODELS,
			},
		},
	});

	const metadata = result.providerMetadata?.gateway as
		| {
				routing?: { finalProvider?: string };
				cost?: string;
				generationId?: string;
		  }
		| undefined;
	const vendor = metadata?.routing?.finalProvider ?? "unknown";
	const cost = metadata?.cost ? Number.parseFloat(metadata.cost) : undefined;

	return {
		content: result.text,
		vendor,
		model: PRIMARY_MODEL,
		inputTokens: result.usage.inputTokens ?? 0,
		outputTokens: result.usage.outputTokens ?? 0,
		cost,
		generationId: metadata?.generationId,
	};
}
