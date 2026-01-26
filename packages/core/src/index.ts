import { generateText } from "ai";
import { PROMPTS } from "./prompts";
import type { LLMResponse, Target } from "./types";

export type { LLMResponse, Target };
export { PROMPTS } from "./prompts";

const VERBOSE = process.env.VERBOSE === "1";

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

	if (VERBOSE) {
		console.log(
			"[VERBOSE] AI Gateway providerMetadata:",
			JSON.stringify(result.providerMetadata, null, 2),
		);
	}

	const metadata = result.providerMetadata?.gateway as
		| {
				routing?: { finalProvider?: string };
				cost?: string;
				marketCost?: string;
				generationId?: string;
		  }
		| undefined;
	const vendor = metadata?.routing?.finalProvider ?? "unknown";
	const costStr = metadata?.marketCost ?? metadata?.cost;
	const cost = costStr ? Number.parseFloat(costStr) : undefined;

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
