import { generateText } from "ai";
import { buildResponse, resolveModel } from "./llm-utils";
import type { LanguageModel, LLMResponse } from "./types";

const SYSTEM_PROMPT = `You are a helpful assistant that summarizes PR intent.
Given a PR diff, explain the purpose and key changes in 2-3 sentences.
Focus on the "why" not just the "what".
Only output the summary, nothing else.`;

export type GeneratePrIntentOptions = {
	model: LanguageModel;
	abortSignal?: AbortSignal;
};

export async function generatePrIntent(
	diff: string,
	options: GeneratePrIntentOptions,
): Promise<LLMResponse> {
	const result = await generateText({
		model: resolveModel(options.model),
		system: SYSTEM_PROMPT,
		prompt: diff,
		maxOutputTokens: 1024,
		abortSignal: options.abortSignal,
	});

	return buildResponse(result, options.model);
}
