import { APICallError } from "ai";
import { PROMPTS } from "./prompts";
import { createCerebrasProvider } from "./providers/cerebras";
import { createOpenAIProvider } from "./providers/openai";
import type {
	LLMMultiResponse,
	LLMProvider,
	LLMResponse,
	Target,
} from "./types";

export type { LLMMultiResponse, LLMProvider, LLMResponse, Target };
export { PROMPTS } from "./prompts";
export { createCerebrasProvider } from "./providers/cerebras";
export { createOpenAIProvider } from "./providers/openai";

interface ProviderConfig {
	name: string;
	envKey: string;
	create: (apiKey: string) => LLMProvider;
}

const PROVIDER_CHAIN: ProviderConfig[] = [
	{ name: "cerebras", envKey: "CEREBRAS_API_KEY", create: createCerebrasProvider },
	{ name: "openai", envKey: "OPENAI_API_KEY", create: createOpenAIProvider },
];

function getProviders(): LLMProvider[] {
	const providers: LLMProvider[] = [];

	for (const config of PROVIDER_CHAIN) {
		const apiKey = process.env[config.envKey];
		if (apiKey) {
			providers.push(config.create(apiKey));
		}
	}

	if (providers.length === 0) {
		const keys = PROVIDER_CHAIN.map((c) => c.envKey).join(" or ");
		throw new Error(`No LLM provider configured. Set ${keys}.`);
	}

	return providers;
}

function isRateLimitError(error: unknown): boolean {
	return APICallError.isInstance(error) && error.statusCode === 429;
}

export async function translate(
	input: string,
	target: Target,
): Promise<LLMResponse> {
	const providers = getProviders();

	for (let i = 0; i < providers.length; i++) {
		const provider = providers[i];
		try {
			return await provider.complete({
				system: PROMPTS[target],
				userMessage: input,
				maxTokens: 1024,
			});
		} catch (error) {
			const isLast = i === providers.length - 1;
			if (isRateLimitError(error) && !isLast) {
				continue;
			}
			throw error;
		}
	}

	throw new Error("No providers available");
}

export async function translateMulti(
	input: string,
	target: Target,
	n: number,
): Promise<LLMMultiResponse> {
	const providers = getProviders();

	for (let i = 0; i < providers.length; i++) {
		const provider = providers[i];

		if (!provider.completeMulti) {
			continue;
		}

		try {
			return await provider.completeMulti({
				system: PROMPTS[target],
				userMessage: input,
				maxTokens: 1024,
				n,
			});
		} catch (error) {
			const isLast = i === providers.length - 1;
			if (isRateLimitError(error) && !isLast) {
				continue;
			}
			throw error;
		}
	}

	throw new Error("No providers with multi-completion support available");
}
