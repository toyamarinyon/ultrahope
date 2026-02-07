/**
 * Minimal reproduction for AI_TypeValidationError with xai/grok-code-fast-1.
 *
 * Grok models emit `response.reasoning_text.delta` SSE events that the AI SDK's
 * openaiResponsesChunkSchema doesn't recognise, causing AI_TypeValidationError.
 * This was fixed for direct @ai-sdk/xai usage (https://github.com/vercel/ai/issues/10491),
 * but AI Gateway internally uses @ai-sdk/openai's responses provider where the
 * schema hasn't been updated yet, so the error still occurs through the gateway.
 *
 * See also: lib/llm/commit-message.ts — isKnownGrokReasoningError()
 *
 * Usage:
 *   eval "$(mise -E amp env)" && bun packages/web/scripts/repro-grok-stream.ts
 */

import { streamText } from "ai";

const DIFF = `diff --git a/README.md b/README.md
index 1234567..abcdefg 100644
--- a/README.md
+++ b/README.md
@@ -1 +1 @@
-# Old Title
+# New Title
`;

const SYSTEM_PROMPT = `You are an expert software engineer that writes high-quality git commit messages.
Given a unified diff, produce a single-line commit message.
Use Conventional Commits format: <type>(<scope>): <subject>
Output plain text only: one line, nothing else.`;

async function main() {
	const model = "xai/grok-code-fast-1";
	console.log(`Model: ${model}`);
	console.log("---");

	const result = streamText({
		model,
		system: SYSTEM_PROMPT,
		prompt: DIFF,
		onError: (error) => {
			console.error("Error:", error);
		},
	});

	let fullText = "";
	for await (const chunk of result.textStream) {
		process.stdout.write(chunk);
		fullText += chunk;
	}
	console.log("\n---");

	const usage = await result.totalUsage;
	console.log("Usage:", JSON.stringify(usage));

	const meta = await result.providerMetadata;
	console.log(
		"Provider metadata keys:",
		meta ? Object.keys(meta) : "undefined",
	);

	console.log("Output:", fullText.trim());
}

main().catch((error) => {
	console.error("Fatal:", error);
	process.exit(1);
});
