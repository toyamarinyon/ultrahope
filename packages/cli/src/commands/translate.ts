import { createApiClient, InsufficientBalanceError } from "../lib/api-client";
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
	model?: string;
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
	const models = options.model ? [options.model] : DEFAULT_MODELS;

	const createGenerator = () =>
		generateCommitMessages({
			diff: input,
			models,
			mock: options.mock,
		});

	if (!options.interactive) {
		const gen = generateCommitMessages({
			diff: input,
			models: models.slice(0, 1),
			mock: options.mock,
		});
		const first = await gen.next();
		console.log(first.value?.content ?? "");
		return;
	}

	while (true) {
		const result = await selectCandidate({
			candidates: createGenerator(),
			maxSlots: models.length,
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
	const models = options.model ? [options.model] : DEFAULT_MODELS;

	const doTranslate = async (): Promise<CandidateWithModel[]> => {
		const candidates: CandidateWithModel[] = [];
		for (const model of models) {
			try {
				const result = await api.translate({
					input,
					target: options.target,
				});
				candidates.push({ content: result.output, model });
			} catch (error) {
				if (error instanceof InsufficientBalanceError) {
					console.error(
						"Error: Token balance exhausted. Upgrade your plan at https://ultrahope.dev/pricing",
					);
					process.exit(1);
				}
				throw error;
			}
		}
		return candidates;
	};

	if (!options.interactive) {
		const result = await api
			.translate({
				input,
				target: options.target,
			})
			.catch((error) => {
				if (error instanceof InsufficientBalanceError) {
					console.error(
						"Error: Token balance exhausted. Upgrade your plan at https://ultrahope.dev/pricing",
					);
					process.exit(1);
				}
				throw error;
			});
		console.log(result.output);
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
	let model: string | undefined;

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
		} else if (arg === "--model") {
			const value = args[++i];
			if (!value) {
				console.error("Error: --model requires a value");
				process.exit(1);
			}
			model = value;
		}
	}

	if (!target) {
		console.error("Error: Missing --target option");
		console.error(
			"Usage: ultrahope translate --target <vcs-commit-message|pr-title-body|pr-intent>",
		);
		process.exit(1);
	}

	return { target, interactive, mock, model };
}
