import { mergeAbortSignals } from "../lib/abort";
import { createApiClient, InsufficientBalanceError } from "../lib/api-client";
import { getToken } from "../lib/auth";
import {
	handleCommandExecutionError,
	startCommandExecution,
} from "../lib/command-execution";
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
		await handleVcsCommitMessage(input, options, args);
		return;
	}

	await handleGenericTarget(input, options, args);
}

async function handleVcsCommitMessage(
	input: string,
	options: TranslateOptions,
	args: string[],
): Promise<void> {
	const models = options.model ? [options.model] : DEFAULT_MODELS;
	let commandExecutionId: string | undefined;
	let commandExecutionSignal: AbortSignal | undefined;
	let apiClient: ReturnType<typeof createApiClient> | null = null;

	if (!options.mock) {
		const token = await getToken();
		if (!token) {
			console.error("Error: Not authenticated. Run `ultrahope login` first.");
			process.exit(1);
		}

		const api = createApiClient(token);
		apiClient = api;
		const {
			commandExecutionPromise,
			abortController,
			commandExecutionId: id,
		} = startCommandExecution({
			api,
			command: "translate",
			args,
			apiPath: "/v1/translate",
			requestPayload:
				models.length === 1
					? { input, target: "vcs-commit-message", model: models[0] }
					: { input, target: "vcs-commit-message", models },
		});

		commandExecutionPromise.catch((error) => {
			abortController.abort();
			handleCommandExecutionError(error);
		});

		commandExecutionId = id;
		commandExecutionSignal = abortController.signal;
	}

	const recordSelection = async (generationId?: string) => {
		if (!generationId || !apiClient) return;
		try {
			await apiClient.recordGenerationScore({
				generationId,
				value: 1,
				comment: null,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`Warning: Failed to record selection. ${message}`);
		}
	};

	const createCandidates = (signal: AbortSignal) =>
		generateCommitMessages({
			diff: input,
			models,
			mock: options.mock,
			signal: mergeAbortSignals(signal, commandExecutionSignal),
			commandExecutionId,
		});

	if (!options.interactive) {
		const gen = generateCommitMessages({
			diff: input,
			models: models.slice(0, 1),
			mock: options.mock,
			signal: commandExecutionSignal,
			commandExecutionId,
		});
		const first = await gen.next();
		await recordSelection(first.value?.generationId);
		console.log(first.value?.content ?? "");
		return;
	}

	while (true) {
		const result = await selectCandidate({
			createCandidates,
			maxSlots: models.length,
		});

		if (result.action === "abort") {
			console.error("Aborted.");
			process.exit(1);
		}

		if (result.action === "reroll") {
			continue;
		}

		if (result.action === "confirm" && result.selected) {
			await recordSelection(result.selectedCandidate?.generationId);
			console.log(result.selected);
			return;
		}
	}
}

async function handleGenericTarget(
	input: string,
	options: TranslateOptions,
	args: string[],
): Promise<void> {
	const token = await getToken();
	if (!token) {
		console.error("Error: Not authenticated. Run `ultrahope login` first.");
		process.exit(1);
	}

	const api = createApiClient(token);
	const models = options.model ? [options.model] : DEFAULT_MODELS;
	const defaultModel = models[0];
	const requestPayload =
		models.length === 1
			? { input, target: options.target, model: models[0] }
			: { input, target: options.target, models };

	const { commandExecutionId, abortController, commandExecutionPromise } =
		startCommandExecution({
			api,
			command: "translate",
			args,
			apiPath: "/v1/translate",
			requestPayload,
		});

	commandExecutionPromise.catch((error) => {
		abortController.abort();
		handleCommandExecutionError(error);
	});

	const isAbortError = (error: unknown) =>
		error instanceof Error && error.name === "AbortError";

	const doTranslate = async (): Promise<CandidateWithModel[]> => {
		const candidates: CandidateWithModel[] = [];
		for (const model of models) {
			try {
				const result = await api.translate(
					{
						commandExecutionId,
						input,
						model,
						target: options.target,
					},
					{ signal: abortController.signal },
				);
				candidates.push({
					content: result.output,
					model,
					generationId: result.generationId,
				});
			} catch (error) {
				if (isAbortError(error) || abortController.signal.aborted) {
					return candidates;
				}
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
		if (!defaultModel) {
			console.error("Error: No model available for translation.");
			process.exit(1);
		}
		const result = await api
			.translate(
				{
					commandExecutionId,
					input,
					model: defaultModel,
					target: options.target,
				},
				{ signal: abortController.signal },
			)
			.catch((error) => {
				if (isAbortError(error) || abortController.signal.aborted) {
					return null;
				}
				if (error instanceof InsufficientBalanceError) {
					console.error(
						"Error: Token balance exhausted. Upgrade your plan at https://ultrahope.dev/pricing",
					);
					process.exit(1);
				}
				throw error;
			});
		if (result) {
			if (result.generationId) {
				try {
					await api.recordGenerationScore({
						generationId: result.generationId,
						value: 1,
						comment: null,
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					console.error(`Warning: Failed to record selection. ${message}`);
				}
			}
			console.log(result.output);
		}
		return;
	}

	let candidates = await doTranslate();

	while (true) {
		const createCandidates = (signal: AbortSignal) =>
			(async function* () {
				for (const candidate of candidates) {
					if (signal.aborted) return;
					yield candidate;
				}
			})();

		const result = await selectCandidate({
			createCandidates,
			maxSlots: candidates.length,
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
			if (result.selectedCandidate?.generationId) {
				try {
					await api.recordGenerationScore({
						generationId: result.selectedCandidate.generationId,
						value: 1,
						comment: null,
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					console.error(`Warning: Failed to record selection. ${message}`);
				}
			}
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
