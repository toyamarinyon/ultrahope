import { generateText } from "ai";
import { PROMPTS } from "./prompts";
import type { LLMMultiResponse, LLMResponse, Target } from "./types";

export type { LLMMultiResponse, LLMResponse, Target };
export { PROMPTS } from "./prompts";

const PRIMARY_MODEL = "cerebras/llama-3.3-70b";
const FALLBACK_MODELS = ["openai/gpt-4o-mini"];

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
		| { routing?: { finalProvider?: string } }
		| undefined;
	const vendor = metadata?.routing?.finalProvider ?? "unknown";

	return {
		content: result.text,
		vendor,
		model: PRIMARY_MODEL,
		inputTokens: result.usage.inputTokens ?? 0,
		outputTokens: result.usage.outputTokens ?? 0,
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
	let inputTokens = 0;
	let outputTokens = 0;

	for (const result of results) {
		contents.push(result.text);
		inputTokens += result.usage.inputTokens ?? 0;
		outputTokens += result.usage.outputTokens ?? 0;
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
	};
}
