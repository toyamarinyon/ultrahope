import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { LLMMultiResponse, LLMProvider, LLMResponse } from "../types";

const MODEL = "gpt-4o-mini";

export function createOpenAIProvider(apiKey: string): LLMProvider {
	const openai = createOpenAI({ apiKey });

	return {
		name: "openai",
		async complete({
			system,
			userMessage,
			maxTokens = 1024,
		}): Promise<LLMResponse> {
			const result = await generateText({
				model: openai(MODEL),
				system,
				prompt: userMessage,
				maxOutputTokens: maxTokens,
			});

			return {
				content: result.text,
				vendor: "openai",
				model: MODEL,
				inputTokens: result.usage.inputTokens ?? 0,
				outputTokens: result.usage.outputTokens ?? 0,
			};
		},

		async completeMulti({
			system,
			userMessage,
			maxTokens = 1024,
			n,
		}): Promise<LLMMultiResponse> {
			const results = await Promise.all(
				Array.from({ length: n }, () =>
					generateText({
						model: openai(MODEL),
						system,
						prompt: userMessage,
						maxOutputTokens: maxTokens,
					}),
				),
			);

			const contents: string[] = [];
			let inputTokens = 0;
			let outputTokens = 0;

			for (const result of results) {
				contents.push(result.text);
				inputTokens += result.usage.inputTokens ?? 0;
				outputTokens += result.usage.outputTokens ?? 0;
			}

			return {
				contents,
				vendor: "openai",
				model: MODEL,
				inputTokens,
				outputTokens,
			};
		},
	};
}
