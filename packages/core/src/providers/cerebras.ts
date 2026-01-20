import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { ChatCompletion } from "@cerebras/cerebras_cloud_sdk/resources/chat/completions";
import type { LLMProvider, LLMResponse } from "../types";

const MODEL = "llama-3.3-70b";

function isChatCompletionResponse(
	response: ChatCompletion,
): response is ChatCompletion.ChatCompletionResponse {
	return response.object === "chat.completion";
}

export function createCerebrasProvider(apiKey: string): LLMProvider {
	const client = new Cerebras({ apiKey });

	return {
		name: "cerebras",
		async complete({
			system,
			userMessage,
			maxTokens = 1024,
		}): Promise<LLMResponse> {
			const response = await client.chat.completions.create({
				model: MODEL,
				max_tokens: maxTokens,
				messages: [
					{ role: "system", content: system },
					{ role: "user", content: userMessage },
				],
			});

			if (!isChatCompletionResponse(response)) {
				throw new Error("Unexpected response type from Cerebras API");
			}

			const choice = response.choices[0];
			const content = choice?.message?.content ?? "";

			return {
				content,
				inputTokens: response.usage.prompt_tokens ?? 0,
				outputTokens: response.usage.completion_tokens ?? 0,
				model: MODEL,
			};
		},
	};
}
