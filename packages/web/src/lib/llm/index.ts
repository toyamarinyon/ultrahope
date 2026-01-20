import { translate as coreTranslate, type Target } from "@ultrahope/core";
import { polarClient } from "@/lib/auth";

type TranslateOptions = {
	externalCustomerId?: string;
	operation?: string;
};

async function recordTokenConsumption(params: {
	externalCustomerId?: string;
	tokens: number;
	inputTokens: number;
	outputTokens: number;
	model: string;
	operation: string;
}): Promise<void> {
	if (!params.externalCustomerId) {
		return;
	}
	if (!process.env.POLAR_ACCESS_TOKEN) {
		console.warn("[polar] POLAR_ACCESS_TOKEN not set, skipping usage ingest");
		return;
	}
	if (!Number.isFinite(params.tokens) || params.tokens <= 0) {
		return;
	}

	try {
		await polarClient.events.ingest({
			events: [
				{
					name: "token_consumption",
					externalCustomerId: params.externalCustomerId,
					metadata: {
						tokens: params.tokens,
						input_tokens: params.inputTokens,
						output_tokens: params.outputTokens,
						model: params.model,
						operation: params.operation,
					},
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

	const totalTokens = response.inputTokens + response.outputTokens;

	void recordTokenConsumption({
		externalCustomerId: options.externalCustomerId,
		tokens: totalTokens,
		inputTokens: response.inputTokens,
		outputTokens: response.outputTokens,
		model: response.model,
		operation: options.operation ?? target,
	});

	return response.content;
}
