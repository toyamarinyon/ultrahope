import {
	translate as coreTranslate,
	type LLMResponse,
	type Target,
} from "@ultrahope/core";
import { polarClient } from "@/lib/auth";
import type { LLMMetadata } from "@polar-sh/sdk/models/components/llmmetadata";

type TranslateOptions = {
	externalCustomerId?: string;
};

async function recordTokenConsumption(
	externalCustomerId: string | undefined,
	response: LLMResponse,
): Promise<void> {
	if (!externalCustomerId) {
		return;
	}
	if (!process.env.POLAR_ACCESS_TOKEN) {
		console.warn("[polar] POLAR_ACCESS_TOKEN not set, skipping usage ingest");
		return;
	}
	const totalTokens = response.inputTokens + response.outputTokens;
	if (!Number.isFinite(totalTokens) || totalTokens <= 0) {
		return;
	}

	const metadata: LLMMetadata = {
		vendor: response.vendor,
		model: response.model,
		inputTokens: response.inputTokens,
		outputTokens: response.outputTokens,
		totalTokens,
		cachedInputTokens: response.cachedInputTokens,
	};

	try {
		await polarClient.events.ingest({
			events: [
				{
					name: "token_consumption",
					externalCustomerId,
					metadata: metadata as unknown as Record<string, string | number>,
				},
			],
		});
	} catch (error) {
		console.error("[polar] Failed to ingest token usage:", error);
	}
}

export async function translate(
	input: string,
	target: Target,
	options: TranslateOptions = {},
): Promise<string> {
	const response = await coreTranslate(input, target);

	void recordTokenConsumption(options.externalCustomerId, response);

	return response.content;
}
