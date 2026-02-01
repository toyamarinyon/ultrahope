import { generateText } from "ai";
import { preprocessDiff } from "./diff";
import { extractGatewayMetadata } from "./gateway-metadata";
import { mockLanguageModel } from "./mock";
import { PROMPTS } from "./prompts";
import type { LanguageModel, LLMResponse, Target } from "./types";

export type { LLMResponse, Target };

const VERBOSE = process.env.VERBOSE === "1";

export async function translate(
	input: string,
	target: Target,
	model: LanguageModel,
	abortSignal?: AbortSignal,
): Promise<LLMResponse> {
	let prompt = input;

	if (target === "vcs-commit-message") {
		const preprocessed = preprocessDiff(input);
		prompt = preprocessed.prompt;
		if (VERBOSE && preprocessed.isStructured) {
			console.log("[VERBOSE] Diff preprocessed with classification");
			console.log(
				"[VERBOSE] Primary files:",
				preprocessed.classification?.primary.map((f) => f.path),
			);
		}
	}

	const result = await generateText({
		model: model === "mocking" ? mockLanguageModel() : model,
		system: PROMPTS[target],
		prompt,
		maxOutputTokens: 1024,
		abortSignal,
	});

	if (VERBOSE) {
		console.log(
			"[VERBOSE] AI Gateway providerMetadata:",
			JSON.stringify(result.providerMetadata, null, 2),
		);
	}

	const { generationId, cost, vendor } = extractGatewayMetadata(
		result.providerMetadata,
	);

	return {
		content: result.text,
		vendor,
		model,
		inputTokens: result.usage.inputTokens ?? 0,
		outputTokens: result.usage.outputTokens ?? 0,
		cost,
		generationId,
	};
}
