import { randomUUID } from "node:crypto";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";

export function mockLanguageModel() {
	return new MockLanguageModelV3({
		doStream: async () => ({
			stream: simulateReadableStream({
				chunks: [
					{ type: "text-start", id: "text-1" },
					{ type: "text-delta", id: "text-1", delta: "{ " },
					{ type: "text-delta", id: "text-1", delta: '"commitMessage": ' },
					{ type: "text-delta", id: "text-1", delta: `"Hello, ` },
					{ type: "text-delta", id: "text-1", delta: `world` },
					{ type: "text-delta", id: "text-1", delta: `!"` },
					{ type: "text-delta", id: "text-1", delta: " }" },
					{ type: "text-end", id: "text-1" },
					{
						type: "finish",
						finishReason: { unified: "stop", raw: "stop" },
						usage: {
							inputTokens: {
								total: 10,
								noCache: 10,
								cacheRead: undefined,
								cacheWrite: undefined,
							},
							outputTokens: {
								total: 20,
								text: 20,
								reasoning: undefined,
							},
						},
						providerMetadata: {
							gateway: {
								generationId: `mock-${randomUUID()}`,
								routing: { finalProvider: "mock" },
								cost: "0",
							},
						},
					},
				],
				chunkDelayInMs: 1000,
			}),
		}),
		doGenerate: async () => {
			await new Promise((resolve) =>
				setTimeout(resolve, 1000 + Math.random() * 500),
			);
			return {
				content: [{ type: "text", text: `Hello, world!` }],
				finishReason: { unified: "stop", raw: undefined },
				usage: {
					inputTokens: {
						total: 10,
						noCache: 10,
						cacheRead: undefined,
						cacheWrite: undefined,
					},
					outputTokens: {
						total: 20,
						text: 20,
						reasoning: undefined,
					},
				},
				providerMetadata: {
					gateway: {
						generationId: `mock-${randomUUID()}`,
						routing: { finalProvider: "mock" },
						cost: "0",
					},
				},
				warnings: [],
			};
		},
	});
}
