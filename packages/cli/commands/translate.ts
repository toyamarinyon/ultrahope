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
import { createStreamCaptureRecorder } from "../lib/stream-capture";
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
	cliModels?: string[];
	captureStreamPath?: string;
}

function exitWithInvalidModelError(error: InvalidModelError): never {
	console.error(`Error: Model '${error.model}' is not supported.`);
	if (error.allowedModels.length > 0) {
		console.error(`Available models: ${error.allowedModels.join(", ")}`);
	}
	process.exit(1);
}

function composeGuidance(guideHint: string | undefined): string | undefined {
	const normalizedGuideHint = guideHint?.trim() ?? "";
	return normalizedGuideHint || undefined;
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

	if (options.captureStreamPath && options.target !== "vcs-commit-message") {
		console.error(
			"Error: --capture-stream is only supported with --target vcs-commit-message.",
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
	const captureRecorder = createStreamCaptureRecorder({
		path: options.captureStreamPath,
		command: "ultrahope translate",
		args,
		apiPath: "/v1/commit-message/stream",
	});
	const models = resolveModels(options.cliModels);

	try {
		const token = await getToken();
		if (!token) {
			console.error("Error: Not authenticated. Run `ultrahope login` first.");
			process.exit(1);
		}

		const api = createApiClient(token);
		const apiClient: ReturnType<typeof createApiClient> | null = api;
		let guideHint: string | undefined;
		let refineMessage: string | undefined;
		let commandExecutionRun = 0;

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

		const startCommandExecutionSession = (isRefineAttempt: boolean) => {
			const sessionId = ++commandExecutionRun;
			const requestGuide = composeGuidance(guideHint);
			const apiPath =
				isRefineAttempt && options.target === "vcs-commit-message"
					? "/v1/commit-message/refine"
					: TARGET_TO_API_PATH[options.target];
			const { commandExecutionPromise, abortController, cliSessionId } =
				startCommandExecution({
					api,
					command: "translate",
					args,
					apiPath,
					requestPayload: {
						...(models.length === 1
							? { input, target: "vcs-commit-message", model: models[0] }
							: { input, target: "vcs-commit-message", models }),
						...(requestGuide ? { guide: requestGuide } : {}),
					},
				});

			commandExecutionPromise.catch(async (error) => {
				if (sessionId !== commandExecutionRun) {
					return;
				}
				abortController.abort(abortReasonForError(error));
				await handleCommandExecutionError(error, {
					progress: { ready: 0, total: models.length },
				});
			});

			return {
				commandExecutionSignal: abortController.signal,
				commandExecutionPromise,
				cliSessionId,
			};
		};

		while (true) {
			const isRefineAttempt = refineMessage !== undefined;
			const { commandExecutionSignal, commandExecutionPromise, cliSessionId } =
				startCommandExecutionSession(isRefineAttempt);
			const createCandidates = (signal: AbortSignal) =>
				generateCommitMessages({
					diff: input,
					models,
					guide: composeGuidance(guideHint),
					signal: mergeAbortSignals(signal, commandExecutionSignal),
					cliSessionId,
					commandExecutionPromise,
					streamCaptureRecorder: captureRecorder,
					refine:
						refineMessage !== undefined
							? {
									originalMessage: refineMessage,
									refineInstruction: guideHint,
								}
							: undefined,
				});

			const result = await selectCandidate({
				createCandidates,
				maxSlots: models.length,
				abortSignal: commandExecutionSignal,
				models,
				inlineEditPrompt: true,
				initialGuideHint: guideHint,
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

			if (result.action === "refine") {
				guideHint = result.guide;
				refineMessage = result.selected ?? result.selectedCandidate?.content;
				continue;
			}

			if (result.action === "confirm" && result.selected) {
				await recordSelection(result.selectedCandidate?.generationId);
				console.log(result.selected);
				return;
			}
		}
	} finally {
		const capturePath = captureRecorder.flush();
		if (capturePath) {
			console.log(`Captured stream replay to ${capturePath}`);
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

	const candidates = await doGenerate();

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
			inlineEditPrompt: true,
		});

		if (result.action === "abort") {
			if (result.error instanceof InvalidModelError) {
				exitWithInvalidModelError(result.error);
			}
			console.error("Aborted.");
			process.exit(1);
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
	let cliModels: string[] | undefined;
	let captureStreamPath: string | undefined;

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
			console.error(
				"Error: --no-interactive is no longer supported. Use interactive mode only.",
			);
			process.exit(1);
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
		} else if (arg === "--capture-stream") {
			const value = args[++i];
			if (!value) {
				console.error("Error: --capture-stream requires a file path");
				process.exit(1);
			}
			captureStreamPath = value;
		}
	}

	if (!target) {
		console.error("Error: Missing --target option");
		console.error(
			"Usage: ultrahope translate --target <vcs-commit-message|pr-title-body|pr-intent>",
		);
		process.exit(1);
	}

	return { target, cliModels, captureStreamPath };
}
