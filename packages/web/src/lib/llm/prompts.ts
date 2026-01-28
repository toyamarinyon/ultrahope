import type { Target } from "./types";

export const PROMPTS: Record<Target, string> = {
	"vcs-commit-message": `You are an expert software engineer that writes high-quality git commit messages.
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
`,

	"pr-title-body": `You are a helpful assistant that generates PR titles and descriptions.
Given git log output with patches, write a clear PR title and body.
Format:
Title: <concise title>

<body describing what changed and why>

Only output the title and body, nothing else.`,

	"pr-intent": `You are a helpful assistant that summarizes PR intent.
Given a PR diff, explain the purpose and key changes in 2-3 sentences.
Focus on the "why" not just the "what".
Only output the summary, nothing else.`,
};
