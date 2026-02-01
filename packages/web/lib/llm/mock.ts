import { MockLanguageModelV3 } from "ai/test";

export function mockLanguageModel() {
	return new MockLanguageModelV3({
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
			warnings: [],
			};
		},
	});
}
