import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
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

Quality rules:
- Do not claim changes not supported by the diff. If intent is unclear, keep it neutral and factual.
- If the diff is mostly formatting, use type "style" and describe what was formatted.
`;

const CommitMessageSchema = z.object({
	commitMessage: z
		.string()
		.describe(
			"A single-line commit message following conventional commits format (e.g., 'feat:', 'fix:', 'refactor:') that captures all changes in one concise sentence",
		),
});

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

	return streamText({
		model: resolveModel(options.model),
		system: SYSTEM_PROMPT,
		prompt: preprocessed.prompt,
		abortSignal: options.abortSignal,
		output: Output.object({
			schema: CommitMessageSchema,
		}),
		providerOptions: {
			openai: {
				reasoningEffort: "none",
			} satisfies OpenAIResponsesProviderOptions,
		},
	});
}

export async function generateCommitMessage(
	diff: string,
	options: GenerateCommitMessageOptions,
): Promise<LLMResponse> {
	const stream = generateCommitMessageStream(diff, options);
	const output = await stream.output;
	const commitMessage = output?.commitMessage;

	if (typeof commitMessage !== "string") {
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
