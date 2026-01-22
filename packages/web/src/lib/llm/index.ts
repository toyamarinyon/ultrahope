import type { LLMMetadata } from "@polar-sh/sdk/models/components/llmmetadata";
import {
	translate as coreTranslate,
	type LLMResponse,
	type Target,
} from "@ultrahope/core";
import { after } from "next/server";
import { polarClient } from "@/lib/auth";

type TranslateOptions = {
	externalCustomerId?: string;
};

export class InsufficientBalanceError extends Error {
	constructor(
		public balance: number,
		public meterId: string,
	) {
		super(`Insufficient token balance: ${balance} tokens remaining`);
		this.name = "InsufficientBalanceError";
	}
}

async function checkMeterBalance(
	externalCustomerId: string,
): Promise<{ balance: number; meterId: string } | null> {
	if (!process.env.POLAR_ACCESS_TOKEN) {
		return null;
	}

	try {
		const response = await polarClient.customerMeters.list({
			externalCustomerId,
			limit: 1,
		});
		const meters = response.result.items;
		if (meters.length === 0) {
			return null;
		}
		const meter = meters[0];
		return { balance: meter.balance, meterId: meter.meterId };
	} catch (error) {
		console.error("[polar] Failed to check meter balance:", error);
		return null;
	}
}

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
		...(response.cachedInputTokens !== undefined && {
			cachedInputTokens: response.cachedInputTokens,
		}),
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
	if (options.externalCustomerId) {
		const meterInfo = await checkMeterBalance(options.externalCustomerId);
		if (meterInfo && meterInfo.balance <= 0) {
			throw new InsufficientBalanceError(meterInfo.balance, meterInfo.meterId);
		}
	}

	const response = await coreTranslate(input, target);

	after(async () => {
		await recordTokenConsumption(options.externalCustomerId, response);
	});

	return response.content;
}
