import Anthropic from "@anthropic-ai/sdk";

type Target = "vcs-commit-message" | "pr-title-body" | "pr-intent";

const PROMPTS: Record<Target, string> = {
	"vcs-commit-message": `You are a helpful assistant that generates concise, clear git commit messages.
Given a diff, write a commit message following conventional commits format.
Be specific about what changed. Keep the subject line under 72 characters.
Only output the commit message, nothing else.`,

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

export async function translate(
	input: string,
	target: Target,
): Promise<string> {
	const apiKey = process.env.MINIMAX_API_KEY;
	if (!apiKey) {
		throw new Error("MINIMAX_API_KEY not configured");
	}

	const client = new Anthropic({
		apiKey,
		baseURL: "https://api.minimax.io/anthropic",
	});

	const message = await client.messages.create({
		model: "MiniMax-M2.1",
		max_tokens: 1024,
		system: PROMPTS[target],
		messages: [{ role: "user", content: input }],
	});

	const textBlock = message.content.find((block) => block.type === "text");
	return textBlock?.text ?? "";
}
