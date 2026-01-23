import { PROMPTS } from "./prompts";
import { createCerebrasProvider } from "./providers/cerebras";
import type {
	LLMMultiResponse,
	LLMProvider,
	LLMResponse,
	Target,
} from "./types";

export type { LLMMultiResponse, LLMProvider, LLMResponse, Target };
export { PROMPTS } from "./prompts";
export { createCerebrasProvider } from "./providers/cerebras";

function getProvider(): LLMProvider {
	const apiKey = process.env.CEREBRAS_API_KEY;
	if (!apiKey) {
		throw new Error("CEREBRAS_API_KEY not configured");
	}
	return createCerebrasProvider(apiKey);
}

export async function translate(
	input: string,
	target: Target,
): Promise<LLMResponse> {
	const provider = getProvider();

	const response = await provider.complete({
		system: PROMPTS[target],
		userMessage: input,
		maxTokens: 1024,
	});

	return response;
}

export async function translateMulti(
	input: string,
	target: Target,
	n: number,
): Promise<LLMMultiResponse> {
	const provider = getProvider();

	if (!provider.completeMulti) {
		throw new Error(
			`Provider ${provider.name} does not support multi-completion`,
		);
	}

	const response = await provider.completeMulti({
		system: PROMPTS[target],
		userMessage: input,
		maxTokens: 1024,
		n,
	});

	return response;
}
