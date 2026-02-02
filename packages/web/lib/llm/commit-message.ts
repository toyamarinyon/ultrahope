import { generateText } from "ai";
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

export type GenerateCommitMessageOptions = {
	model: LanguageModel;
	abortSignal?: AbortSignal;
};

export async function generateCommitMessage(
	diff: string,
	options: GenerateCommitMessageOptions,
): Promise<LLMResponse> {
	const preprocessed = preprocessDiff(diff);

	if (preprocessed.isStructured) {
		verboseLog("Diff preprocessed with classification");
		verboseLog(
			"Primary files:",
			preprocessed.classification?.primary.map((f) => f.path),
		);
	}

	const result = await generateText({
		model: resolveModel(options.model),
		system: SYSTEM_PROMPT,
		prompt: preprocessed.prompt,
		maxOutputTokens: 1024,
		abortSignal: options.abortSignal,
	});

	return buildResponse(result, options.model);
}
