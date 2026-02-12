import {
	abortReasonForError,
	isCommandExecutionAbort,
	mergeAbortSignals,
} from "../lib/abort";
import {
	createApiClient,
	type GenerateResponse,
	InsufficientBalanceError,
	InvalidModelError,
} from "../lib/api-client";
import { getToken } from "../lib/auth";
import {
	handleCommandExecutionError,
	startCommandExecution,
} from "../lib/command-execution";
import { parseModelsArg, resolveModels } from "../lib/config";
import { type CandidateWithModel, selectCandidate } from "../lib/selector";
import { stdin } from "../lib/stdin";
import { generateCommitMessages } from "../lib/vcs-message-generator";

type Target = "vcs-commit-message" | "pr-title-body" | "pr-intent";

const VALID_TARGETS: Target[] = [
	"vcs-commit-message",
	"pr-title-body",
	"pr-intent",
];

const TARGET_TO_API_PATH: Record<Target, string> = {
	"vcs-commit-message": "/v1/commit-message",
	"pr-title-body": "/v1/pr-title-body",
	"pr-intent": "/v1/pr-intent",
};

interface TranslateOptions {
	target: Target;
	interactive: boolean;
	cliModels?: string[];
}

function exitWithInvalidModelError(error: InvalidModelError): never {
	console.error(`Error: Model '${error.model}' is not supported.`);
	if (error.allowedModels.length > 0) {
		console.error(`Available models: ${error.allowedModels.join(", ")}`);
	}
	process.exit(1);
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
	const models = resolveModels(options.cliModels);

	const token = await getToken();
	if (!token) {
		console.error("Error: Not authenticated. Run `ultrahope login` first.");
		process.exit(1);
	}

	const api = createApiClient(token);
	const {
		commandExecutionPromise: promise,
		abortController,
		cliSessionId: id,
	} = startCommandExecution({
		api,
		command: "translate",
		args,
		apiPath: TARGET_TO_API_PATH[options.target],
		requestPayload:
			models.length === 1
				? { input, target: "vcs-commit-message", model: models[0] }
				: { input, target: "vcs-commit-message", models },
	});

	const cliSessionId: string | undefined = id;
	const commandExecutionSignal: AbortSignal | undefined =
		abortController.signal;
	const commandExecutionPromise: Promise<unknown> | undefined = promise;
	const apiClient: ReturnType<typeof createApiClient> | null = api;

	commandExecutionPromise.catch(async (error) => {
		abortController.abort(abortReasonForError(error));
		await handleCommandExecutionError(error, {
			progress: { ready: 0, total: models.length },
		});
	});

	const recordSelection = async (generationId?: string) => {
		if (!generationId || !apiClient) return;
		try {
			await apiClient.recordGenerationScore({
				generationId,
				value: 1,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes("Generation not found")) {
				return;
			}
			console.error(`Warning: Failed to record selection. ${message}`);
		}
	};

	const createCandidates = (signal: AbortSignal) =>
		generateCommitMessages({
			diff: input,
			models,
			signal: mergeAbortSignals(signal, commandExecutionSignal),
			cliSessionId,
			commandExecutionPromise,
		});

	if (!options.interactive) {
		const gen = generateCommitMessages({
			diff: input,
			models: models.slice(0, 1),
			signal: commandExecutionSignal,
			cliSessionId,
			commandExecutionPromise,
		});
		const first = await gen.next().catch((error) => {
			if (error instanceof InvalidModelError) {
				exitWithInvalidModelError(error);
			}
			throw error;
		});
		await recordSelection(first.value?.generationId);
		console.log(first.value?.content ?? "");
		return;
	}

	while (true) {
		const result = await selectCandidate({
			createCandidates,
			maxSlots: models.length,
			abortSignal: commandExecutionSignal,
			models,
		});

		if (result.action === "abort") {
			if (result.error instanceof InvalidModelError) {
				exitWithInvalidModelError(result.error);
			}
			if (isCommandExecutionAbort(commandExecutionSignal)) {
				return;
			}
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
	const models = resolveModels(options.cliModels);
	const defaultModel = models[0];
	const requestPayload =
		models.length === 1
			? { input, target: options.target, model: models[0] }
			: { input, target: options.target, models };

	const {
		commandExecutionId: cliSessionId,
		abortController,
		commandExecutionPromise,
	} = startCommandExecution({
		api,
		command: "translate",
		args,
		apiPath: TARGET_TO_API_PATH[options.target],
		requestPayload,
	});

	const ensureCommandExecution = commandExecutionPromise.catch(
		async (error) => {
			abortController.abort(abortReasonForError(error));
			await handleCommandExecutionError(error);
		},
	);

	const isAbortError = (error: unknown) =>
		error instanceof Error && error.name === "AbortError";
	const isInvalidCliSessionIdError = (error: unknown) =>
		error instanceof Error && error.message.includes("Invalid cliSessionId");
	const delay = (ms: number) =>
		new Promise<void>((resolve) => setTimeout(resolve, ms));

	const generateFn = (req: {
		cliSessionId: string;
		input: string;
		model: string;
	}) => {
		if (options.target === "pr-title-body") {
			return api.generatePrTitleBody(req, { signal: abortController.signal });
		}
		if (options.target === "pr-intent") {
			return api.generatePrIntent(req, { signal: abortController.signal });
		}
		return api.generateCommitMessage(req, { signal: abortController.signal });
	};

	const generateWithRetry = async (
		model: string,
	): Promise<GenerateResponse> => {
		const maxAttempts = 3;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				return await generateFn({ cliSessionId, input, model });
			} catch (error) {
				if (isAbortError(error) || abortController.signal.aborted) throw error;
				if (isInvalidCliSessionIdError(error) && attempt < maxAttempts - 1) {
					await delay(80 * (attempt + 1));
					continue;
				}
				if (isInvalidCliSessionIdError(error)) {
					try {
						await ensureCommandExecution;
					} catch {
						const abortError = new Error("Aborted");
						abortError.name = "AbortError";
						throw abortError;
					}
				}
				throw error;
			}
		}
		throw new Error("Failed to generate after retries.");
	};

	const doGenerate = async (): Promise<CandidateWithModel[]> => {
		const candidates: CandidateWithModel[] = [];
		for (const model of models) {
			try {
				const result = await generateWithRetry(model);
				candidates.push({
					content: result.output,
					slotId: model,
					model,
					generationId: result.generationId,
				});
			} catch (error) {
				if (isAbortError(error) || abortController.signal.aborted) {
					return candidates;
				}
				if (error instanceof InvalidModelError) {
					exitWithInvalidModelError(error);
				}
				if (error instanceof InsufficientBalanceError) {
					console.error(error.formatMessage());
					process.exit(1);
				}
				throw error;
			}
		}
		return candidates;
	};

	if (!options.interactive) {
		if (!defaultModel) {
			console.error("Error: No model available for generation.");
			process.exit(1);
		}
		const result = await generateWithRetry(defaultModel).catch((error) => {
			if (isAbortError(error) || abortController.signal.aborted) {
				return null;
			}
			if (error instanceof InvalidModelError) {
				exitWithInvalidModelError(error);
			}
			if (error instanceof InsufficientBalanceError) {
				console.error(error.formatMessage());
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
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					if (!message.includes("Generation not found")) {
						console.error(`Warning: Failed to record selection. ${message}`);
					}
				}
			}
			console.log(result.output);
		}
		return;
	}

	let candidates = await doGenerate();

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
			models: candidates.map((c) => c.model).filter(Boolean) as string[],
		});

		if (result.action === "abort") {
			if (result.error instanceof InvalidModelError) {
				exitWithInvalidModelError(result.error);
			}
			console.error("Aborted.");
			process.exit(1);
		}

		if (result.action === "reroll") {
			candidates = await doGenerate();
			continue;
		}

		if (result.action === "confirm" && result.selected) {
			if (result.selectedCandidate?.generationId) {
				try {
					await api.recordGenerationScore({
						generationId: result.selectedCandidate.generationId,
						value: 1,
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					if (!message.includes("Generation not found")) {
						console.error(`Warning: Failed to record selection. ${message}`);
					}
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
	let cliModels: string[] | undefined;

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
		} else if (arg === "--models") {
			const value = args[++i];
			if (!value) {
				console.error("Error: --models requires a value");
				process.exit(1);
			}
			cliModels = parseModelsArg(value);
		} else if (arg === "--model") {
			console.error("Error: --model is no longer supported. Use --models.");
			process.exit(1);
		}
	}

	if (!target) {
		console.error("Error: Missing --target option");
		console.error(
			"Usage: ultrahope translate --target <vcs-commit-message|pr-title-body|pr-intent>",
		);
		process.exit(1);
	}

	return { target, interactive, cliModels };
}
