import fs from "node:fs/promises";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { LanguageModelUsage, ProviderMetadata } from "ai";
import { Output, streamText } from "ai";
import { z } from "zod";

type StreamEvent =
	| { type: "commit-message"; commitMessage: string }
	| { type: "usage"; usage: LanguageModelUsage }
	| {
			type: "provider-metadata";
			providerMetadata: ProviderMetadata | undefined;
	  }
	| { type: "error"; message: string };

const encoder = new TextEncoder();

function formatEvent(event: StreamEvent): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Streams AI-generated commit messages with partial updates using Server-Sent Events (SSE).
 *
 * @example
 * // Streaming partial commit messages
 * data: {"type":"commit-message","commitMessage":""}
 * data: {"type":"commit-message","commitMessage":"feat"}
 * data: {"type":"commit-message","commitMessage":"feat(web): add SSE streaming"}
 *
 * @example
 * // Final events sent at the end of the stream
 * data: {"type":"usage","usage":{"inputTokens":3257,"outputTokens":33,"totalTokens":3290}}
 * data: {"type":"provider-metadata","providerMetadata":{"openai":{"responseId":"..."}}}
 */
export async function GET() {
	const diff = await fs.readFile("./diff.txt", "utf-8");
	const stream = streamText({
		model: "openai/gpt-5.1",
		providerOptions: {
			openai: {
				reasoningEffort: "none",
				textVerbosity: "low",
			} satisfies OpenAIResponsesProviderOptions,
		},
		output: Output.object({
			schema: z.object({
				commitMessage: z
					.string()
					.describe(
						"A single-line commit message following conventional commits format (e.g., 'feat:', 'fix:', 'refactor:') that captures all changes in one concise sentence",
					),
			}),
		}),
		messages: [
			{
				role: "system",
				content: "Generate commit message from user input(diff, conversation)",
			},
			{
				role: "user",
				content: diff,
			},
		],
	});

	const customStream = new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				let lastCommitMessage = "";

				for await (const partial of stream.partialOutputStream) {
					const commitMessage = partial?.commitMessage;
					if (typeof commitMessage === "string") {
						lastCommitMessage = commitMessage;
						controller.enqueue(
							formatEvent({ type: "commit-message", commitMessage }),
						);
					}
				}

				if (lastCommitMessage.length === 0) {
					const output = await stream.output;
					if (typeof output?.commitMessage === "string") {
						controller.enqueue(
							formatEvent({
								type: "commit-message",
								commitMessage: output.commitMessage,
							}),
						);
					}
				}

				const [usage, providerMetadata] = await Promise.all([
					stream.totalUsage,
					stream.providerMetadata,
				]);

				controller.enqueue(formatEvent({ type: "usage", usage }));
				controller.enqueue(
					formatEvent({ type: "provider-metadata", providerMetadata }),
				);
				controller.close();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				controller.enqueue(formatEvent({ type: "error", message }));
				controller.close();
			}
		},
	});

	return new Response(customStream, {
		headers: { "Content-Type": "text/event-stream" },
	});
}
