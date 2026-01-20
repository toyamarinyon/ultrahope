#!/usr/bin/env bun
import {
	createCerebrasProvider,
	PROMPTS,
	type Target,
} from "../packages/core/src";

const VALID_TARGETS: Target[] = [
	"vcs-commit-message",
	"pr-title-body",
	"pr-intent",
];

function parseArgs(): { target: Target; verbose: boolean } {
	const args = process.argv.slice(2);
	const verbose = args.includes("-v") || args.includes("--verbose");

	const positional = args.filter((a) => !a.startsWith("-"));
	const target = positional[0] as Target | undefined;

	if (!target || !VALID_TARGETS.includes(target)) {
		console.error("Usage: bun scripts/translate.ts <target> [-v]");
		console.error(
			"       echo 'diff' | bun scripts/translate.ts vcs-commit-message",
		);
		console.error(`Targets: ${VALID_TARGETS.join(", ")}`);
		process.exit(1);
	}

	return { target, verbose };
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of Bun.stdin.stream()) {
		chunks.push(Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
	const { target, verbose } = parseArgs();

	const apiKey = process.env.CEREBRAS_API_KEY;
	if (!apiKey) {
		console.error("Error: CEREBRAS_API_KEY not set");
		process.exit(1);
	}

	const input = await readStdin();
	if (!input.trim()) {
		console.error("Error: No input provided. Pipe content to stdin.");
		process.exit(1);
	}

	const provider = createCerebrasProvider(apiKey);

	if (verbose) {
		console.error(`[llm] target: ${target}`);
		console.error(`[llm] input: ${input.length} chars`);
	}

	const response = await provider.complete({
		system: PROMPTS[target],
		userMessage: input,
		maxTokens: 1024,
	});

	if (verbose) {
		console.error(`[llm] model: ${response.model}`);
		console.error(
			`[llm] tokens: ${response.inputTokens} in, ${response.outputTokens} out`,
		);
	}

	console.log(response.content);
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
