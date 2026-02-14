import { streamText } from "ai";
import { preprocessDiff } from "./diff";
import { buildResponse, resolveModel, verboseLog } from "./llm-utils";
import type { LanguageModel, LLMResponse } from "./types";

const SYSTEM_PROMPT = `You are an expert software engineer that writes high-quality git commit messages.
Given a unified diff, produce a single-line commit message.

Output requirements:
- Output plain text only: one line, nothing else (no markdown, no code fences, no body).
- Use Conventional Commits format: <type>(<scope>): <subject>
  - type: feat|fix|refactor|perf|docs|test|build|ci|chore|style
  - scope: optional; infer from file paths or package/module name (e.g. core, cli, web)
  - subject: imperative mood, present tense, no trailing period, <= 72 characters
- Do NOT include a body or additional lines. Output exactly one line.
- Do NOT surround the commit message with backticks (single or triple).

Quality rules:
- Do not claim changes not supported by the diff. If intent is unclear, keep it neutral and factual.
- If the diff is mostly formatting, use type "style" and describe what was formatted.
`;

let grokReasoningErrorWarned = false;

// Grok models emit `response.reasoning_text.delta` SSE events that the AI SDK's
// openaiResponsesChunkSchema doesn't recognise, causing AI_TypeValidationError.
// This was fixed for direct @ai-sdk/xai usage (https://github.com/vercel/ai/issues/10491),
// but AI Gateway internally uses @ai-sdk/openai's responses provider where the
// schema hasn't been updated yet, so the error still occurs through the gateway.
function isKnownGrokReasoningError(
	error: unknown,
	model: LanguageModel,
): boolean {
	if (!String(model).includes("grok")) return false;
	if (
		typeof error !== "object" ||
		error === null ||
		!("name" in error) ||
		(error as { name: string }).name !== "AI_TypeValidationError"
	)
		return false;
	const value = (error as { value?: unknown }).value;
	return (
		typeof value === "object" &&
		value !== null &&
		"type" in value &&
		(value as { type: string }).type.startsWith("response.reasoning_text.")
	);
}

export type GenerateCommitMessageOptions = {
	model: LanguageModel;
	abortSignal?: AbortSignal;
};

export type GenerateCommitMessageStreamOptions = GenerateCommitMessageOptions;

export function generateCommitMessageStream(
	diff: string,
	options: GenerateCommitMessageStreamOptions,
) {
	const preprocessed = preprocessDiff(diff);

	if (preprocessed.isStructured) {
		verboseLog("Diff preprocessed with classification");
		verboseLog(
			"Primary files:",
			preprocessed.classification?.primary.map((f) => f.path),
		);
	}

	const resolved = resolveModel(options.model);

	return streamText({
		model: resolved,
		system: SYSTEM_PROMPT,
		prompt: preprocessed.prompt,
		abortSignal: options.abortSignal,
		onError({ error }) {
			if (isKnownGrokReasoningError(error, options.model)) {
				if (!grokReasoningErrorWarned) {
					grokReasoningErrorWarned = true;
					console.warn(
						"[commit-message] Ignoring known AI_TypeValidationError for grok reasoning_text.delta chunk. " +
							"See https://github.com/vercel/ai/issues/10491",
					);
				}
				return;
			}
			console.error(
				`[commit-message] streamText onError (model: ${String(options.model)}):`,
				error,
			);
		},
	});
}

function normalizeCommitMessage(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

export async function generateCommitMessage(
	diff: string,
	options: GenerateCommitMessageOptions,
): Promise<LLMResponse> {
	const stream = generateCommitMessageStream(diff, options);
	const outputText = await stream.text;
	const commitMessage = normalizeCommitMessage(outputText);

	if (!commitMessage) {
		throw new Error("Failed to generate commit message.");
	}

	const [usage, providerMetadata] = await Promise.all([
		stream.totalUsage,
		stream.providerMetadata,
	]);

	return buildResponse(
		{
			text: commitMessage,
			usage: {
				inputTokens: usage.inputTokens,
				outputTokens: usage.outputTokens,
			},
			providerMetadata,
		},
		options.model,
	);
}
