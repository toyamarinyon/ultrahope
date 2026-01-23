import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { ChatCompletion } from "@cerebras/cerebras_cloud_sdk/resources/chat/completions";
import type { LLMMultiResponse, LLMProvider, LLMResponse } from "../types";

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
				vendor: "cerebras",
				model: MODEL,
				inputTokens: response.usage.prompt_tokens ?? 0,
				outputTokens: response.usage.completion_tokens ?? 0,
			};
		},

		async completeMulti({
			system,
			userMessage,
			maxTokens = 1024,
			n,
		}): Promise<LLMMultiResponse> {
			const responses = await Promise.all(
				Array.from({ length: n }, () =>
					client.chat.completions.create({
						model: MODEL,
						max_tokens: maxTokens,
						messages: [
							{ role: "system", content: system },
							{ role: "user", content: userMessage },
						],
					}),
				),
			);

			const contents: string[] = [];
			let inputTokens = 0;
			let outputTokens = 0;

			for (const response of responses) {
				if (!isChatCompletionResponse(response)) {
					throw new Error("Unexpected response type from Cerebras API");
				}
				const choice = response.choices[0];
				contents.push(choice?.message?.content ?? "");
				inputTokens += response.usage.prompt_tokens ?? 0;
				outputTokens += response.usage.completion_tokens ?? 0;
			}

			return {
				contents,
				vendor: "cerebras",
				model: MODEL,
				inputTokens,
				outputTokens,
			};
		},
	};
}
