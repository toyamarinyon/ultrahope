import { generateText } from "ai";
import { PROMPTS } from "./prompts";
import type {
	LLMMultiResponse,
	LLMResponse,
	ModelResult,
	MultiModelResponse,
	Target,
} from "./types";
import { DEFAULT_MODELS } from "./types";

export type {
	LLMMultiResponse,
	LLMResponse,
	ModelResult,
	MultiModelResponse,
	Target,
};
export { PROMPTS } from "./prompts";
export { DEFAULT_MODELS } from "./types";

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

export async function translateMulti(
	input: string,
	target: Target,
	n: number,
): Promise<LLMMultiResponse> {
	const results = await Promise.all(
		Array.from({ length: n }, () =>
			generateText({
				model: PRIMARY_MODEL,
				system: PROMPTS[target],
				prompt: input,
				maxOutputTokens: 1024,
				providerOptions: {
					gateway: {
						models: FALLBACK_MODELS,
					},
				},
			}),
		),
	);

	const contents: string[] = [];
	const generationIds: string[] = [];
	let inputTokens = 0;
	let outputTokens = 0;
	let totalCost = 0;

	for (const result of results) {
		contents.push(result.text);
		inputTokens += result.usage.inputTokens ?? 0;
		outputTokens += result.usage.outputTokens ?? 0;

		const meta = result.providerMetadata?.gateway as
			| { cost?: string; generationId?: string }
			| undefined;
		if (meta?.cost) {
			totalCost += Number.parseFloat(meta.cost);
		}
		if (meta?.generationId) {
			generationIds.push(meta.generationId);
		}
	}

	const metadata = results[0]?.providerMetadata?.gateway as
		| { routing?: { finalProvider?: string } }
		| undefined;
	const vendor = metadata?.routing?.finalProvider ?? "unknown";

	return {
		contents,
		vendor,
		model: PRIMARY_MODEL,
		inputTokens,
		outputTokens,
		cost: totalCost > 0 ? totalCost : undefined,
		generationIds: generationIds.length > 0 ? generationIds : undefined,
	};
}

export async function translateMultiModel(
	input: string,
	target: Target,
	models: string[] = [...DEFAULT_MODELS],
): Promise<MultiModelResponse> {
	const settled = await Promise.allSettled(
		models.map(async (model) => {
			const result = await generateText({
				model,
				system: PROMPTS[target],
				prompt: input,
				maxOutputTokens: 1024,
			});

			const metadata = result.providerMetadata?.gateway as
				| { cost?: string; generationId?: string }
				| undefined;

			return {
				model,
				content: result.text,
				inputTokens: result.usage.inputTokens ?? 0,
				outputTokens: result.usage.outputTokens ?? 0,
				cost: metadata?.cost ? Number.parseFloat(metadata.cost) : undefined,
				generationId: metadata?.generationId,
			} satisfies ModelResult;
		}),
	);

	const results: ModelResult[] = [];
	let totalCost = 0;

	for (const outcome of settled) {
		if (outcome.status === "fulfilled") {
			results.push(outcome.value);
			if (outcome.value.cost) {
				totalCost += outcome.value.cost;
			}
		}
	}

	return {
		results,
		totalCost: totalCost > 0 ? totalCost : undefined,
	};
}
