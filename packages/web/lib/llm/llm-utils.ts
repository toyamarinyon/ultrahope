import { extractGatewayMetadata } from "./gateway-metadata";
import { mockLanguageModel } from "./mock";
import type { LanguageModel, LLMResponse } from "./types";

const VERBOSE = process.env.VERBOSE === "1";

export type LLMCallResult = {
	text: string;
	usage: { inputTokens?: number; outputTokens?: number };
	providerMetadata: unknown;
};

export function resolveModel(model: LanguageModel) {
	return model === "mocking" ? mockLanguageModel() : model;
}

export function buildResponse(
	result: LLMCallResult,
	model: LanguageModel,
): LLMResponse {
	if (VERBOSE) {
		console.log(
			"[VERBOSE] AI Gateway providerMetadata:",
			JSON.stringify(result.providerMetadata, null, 2),
		);
	}

	const { generationId, cost, vendor, gatewayPayload } = extractGatewayMetadata(
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
		gatewayPayload,
	};
}

export function verboseLog(...args: unknown[]) {
	if (VERBOSE) {
		console.log("[VERBOSE]", ...args);
	}
}
