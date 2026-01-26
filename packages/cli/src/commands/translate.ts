import {
	createApiClient,
	InsufficientBalanceError,
	type MultiModelResult,
} from "../lib/api-client";
import { getToken } from "../lib/auth";
import { type CandidateWithModel, selectCandidate } from "../lib/selector";
import { stdin } from "../lib/stdin";
import {
	DEFAULT_MODELS,
	generateCommitMessages,
} from "../lib/vcs-message-generator";

type Target = "vcs-commit-message" | "pr-title-body" | "pr-intent";

const VALID_TARGETS: Target[] = [
	"vcs-commit-message",
	"pr-title-body",
	"pr-intent",
];

interface TranslateOptions {
	target: Target;
	interactive: boolean;
	mock: boolean;
	models: string[];
}

export async function translate(args: string[]) {
	const options = parseArgs(args);
	const input = await stdin();

	if (!input.trim()) {
		console.error(
			"Error: No input provided. Pipe content to ultrahope translate.",
		);
		process.exit(1);
	}

	if (options.target === "vcs-commit-message") {
		await handleVcsCommitMessage(input, options);
		return;
	}

	await handleGenericTarget(input, options);
}

async function handleVcsCommitMessage(
	input: string,
	options: TranslateOptions,
): Promise<void> {
	const createGenerator = () =>
		generateCommitMessages({
			diff: input,
			models: options.models,
			mock: options.mock,
		});

	if (!options.interactive) {
		const gen = generateCommitMessages({
			diff: input,
			models: options.models.slice(0, 1),
			mock: options.mock,
		});
		const first = await gen.next();
		console.log(first.value?.content ?? "");
		return;
	}

	while (true) {
		const result = await selectCandidate({
			candidates: createGenerator(),
			maxSlots: options.models.length,
			prompt: "Select a result:",
		});

		if (result.action === "abort") {
			console.error("Aborted.");
			process.exit(1);
		}

		if (result.action === "reroll") {
			continue;
		}

		if (result.action === "confirm" && result.selected) {
			console.log(result.selected);
			return;
		}
	}
}

async function handleGenericTarget(
	input: string,
	options: TranslateOptions,
): Promise<void> {
	const token = await getToken();
	if (!token) {
		console.error("Error: Not authenticated. Run `ultrahope login` first.");
		process.exit(1);
	}

	const api = createApiClient(token);

	const doTranslate = async (): Promise<CandidateWithModel[]> => {
		try {
			const result = await api.translate({
				input,
				target: options.target,
				models: options.models,
			});
			if ("results" in result) {
				return result.results.map((r: MultiModelResult) => ({
					content: r.output,
					model: r.model,
					cost: r.cost,
				}));
			}
			if ("outputs" in result) {
				return result.outputs.map((output: string) => ({ content: output }));
			}
			return [{ content: result.output }];
		} catch (error) {
			if (error instanceof InsufficientBalanceError) {
				console.error(
					"Error: Token balance exhausted. Upgrade your plan at https://ultrahope.dev/pricing",
				);
				process.exit(1);
			}
			throw error;
		}
	};

	if (!options.interactive) {
		const candidates = await doTranslate();
		console.log(candidates[0]?.content ?? "");
		return;
	}

	let candidates = await doTranslate();

	while (true) {
		const result = await selectCandidate({
			candidates,
			prompt: "Select a result:",
		});

		if (result.action === "abort") {
			console.error("Aborted.");
			process.exit(1);
		}

		if (result.action === "reroll") {
			candidates = await doTranslate();
			continue;
		}

		if (result.action === "confirm" && result.selected) {
			console.log(result.selected);
			return;
		}
	}
}

function parseArgs(args: string[]): TranslateOptions {
	let target: Target | undefined;
	let interactive = true;
	let mock = false;
	let models: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--target" || arg === "-t") {
			const value = args[++i];
			if (!value || !VALID_TARGETS.includes(value as Target)) {
				console.error(`Error: Invalid target "${value}"`);
				console.error(`Valid targets: ${VALID_TARGETS.join(", ")}`);
				process.exit(1);
			}
			target = value as Target;
		} else if (arg === "--no-interactive") {
			interactive = false;
		} else if (arg === "--mock") {
			mock = true;
		} else if (arg === "--models") {
			const value = args[++i];
			if (!value) {
				console.error("Error: --models requires a comma-separated list");
				process.exit(1);
			}
			models = value.split(",").map((m) => m.trim());
		}
	}

	if (!target) {
		console.error("Error: Missing --target option");
		console.error(
			"Usage: ultrahope translate --target <vcs-commit-message|pr-title-body|pr-intent>",
		);
		process.exit(1);
	}

	if (models.length === 0) {
		models = DEFAULT_MODELS;
	}

	return { target, interactive, mock, models };
}
