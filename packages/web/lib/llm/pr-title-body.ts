import { generateText } from "ai";
import { buildResponse, resolveModel } from "./llm-utils";
import type { LanguageModel, LLMResponse } from "./types";

const SYSTEM_PROMPT = `You are a helpful assistant that generates PR titles and descriptions.
Given git log output with patches, write a clear PR title and body.
Format:
Title: <concise title>

<body describing what changed and why>

Only output the title and body, nothing else.`;

export type GeneratePrTitleBodyOptions = {
	model: LanguageModel;
	abortSignal?: AbortSignal;
};

export async function generatePrTitleBody(
	input: string,
	options: GeneratePrTitleBodyOptions,
): Promise<LLMResponse> {
	const result = await generateText({
		model: resolveModel(options.model),
		system: SYSTEM_PROMPT,
		prompt: input,
		maxOutputTokens: 1024,
		abortSignal: options.abortSignal,
	});

	return buildResponse(result, options.model);
}
