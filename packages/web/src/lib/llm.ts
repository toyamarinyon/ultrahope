import Anthropic from "@anthropic-ai/sdk";
import { polarClient } from "@/lib/auth";

type Target = "vcs-commit-message" | "pr-title-body" | "pr-intent";

type TranslateOptions = {
	externalCustomerId?: string;
	operation?: string;
};

const MODEL = "MiniMax-M2.1";

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

async function recordTokenConsumption(params: {
	externalCustomerId?: string;
	tokens: number;
	inputTokens: number;
	outputTokens: number;
	model: string;
	operation: string;
}): Promise<void> {
	if (!params.externalCustomerId) {
		return;
	}
	if (!process.env.POLAR_ACCESS_TOKEN) {
		console.warn("[polar] POLAR_ACCESS_TOKEN not set, skipping usage ingest");
		return;
	}
	if (!Number.isFinite(params.tokens) || params.tokens <= 0) {
		return;
	}

	try {
		await polarClient.events.ingest({
			events: [
				{
					name: "token_consumption",
					externalCustomerId: params.externalCustomerId,
					metadata: {
						tokens: params.tokens,
						input_tokens: params.inputTokens,
						output_tokens: params.outputTokens,
						model: params.model,
						operation: params.operation,
					},
				},
			],
		});
	} catch (error) {
		console.error("[polar] Failed to ingest token usage:", error);
	}
}

export async function translate(
	input: string,
	target: Target,
	options: TranslateOptions = {},
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
		model: MODEL,
		max_tokens: 1024,
		system: PROMPTS[target],
		messages: [{ role: "user", content: input }],
	});

	const textBlock = message.content.find((block) => block.type === "text");
	const output = textBlock?.text ?? "";

	const inputTokens = message.usage?.input_tokens ?? 0;
	const outputTokens = message.usage?.output_tokens ?? 0;
	const totalTokens = inputTokens + outputTokens;

	void recordTokenConsumption({
		externalCustomerId: options.externalCustomerId,
		tokens: totalTokens,
		inputTokens,
		outputTokens,
		model: MODEL,
		operation: options.operation ?? target,
	});

	return output;
}
