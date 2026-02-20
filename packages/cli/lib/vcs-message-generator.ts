import { raceAsyncIterators } from "../../shared/async-race";
import type { CandidateWithModel } from "../../shared/terminal-selector-contract";
import {
	type CommitMessageStreamEvent,
	createApiClient,
	extractGatewayMetadata,
	InsufficientBalanceError,
	InvalidModelError,
} from "./api-client";
import { getToken } from "./auth";
import { log } from "./logger";
import type { StreamCaptureRecorder } from "./stream-capture";

export const DEFAULT_MODELS = [
	// "mistral/ministral-3b",
	// "cerebras/qwen-3-235b",
	// "openai/gpt-5.1",
	"mistral/ministral-3b",
	"xai/grok-code-fast-1",
];

export interface GeneratorOptions {
	diff: string;
	models: string[];
	hint?: string;
	signal?: AbortSignal;
	cliSessionId?: string;
	commandExecutionPromise?: Promise<unknown>;
	useStream?: boolean;
	streamCaptureRecorder?: StreamCaptureRecorder;
}

const isAbortError = (error: unknown) =>
	error instanceof Error && error.name === "AbortError";

const isInvalidCliSessionIdError = (error: unknown) =>
	error instanceof Error && error.message.includes("Invalid cliSessionId");

const delay = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function* generateCommitMessages(
	options: GeneratorOptions,
): AsyncGenerator<CandidateWithModel> {
	const {
		diff,
		models,
		signal,
		cliSessionId,
		commandExecutionPromise,
		useStream = false,
		streamCaptureRecorder,
	} = options;

	const resolvedCliSessionId = cliSessionId;
	if (!resolvedCliSessionId) {
		throw new Error("Missing cliSessionId for generate request.");
	}
	const requiredCliSessionId: string = resolvedCliSessionId;
	const captureGenerationId = streamCaptureRecorder?.startGeneration({
		cliSessionId: requiredCliSessionId,
		models,
	});

	const token = await getToken();
	if (!token) {
		console.error("Error: Not authenticated. Run `ultrahope login` first.");
		process.exit(1);
	}

	const api = createApiClient(token);

	const generateWithRetry = async function* (payload: {
		cliSessionId: string;
		input: string;
		model: string;
		hint?: string;
	}): AsyncGenerator<CommitMessageStreamEvent> {
		const maxAttempts = 3;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const attemptNumber = attempt + 1;
			try {
				for await (const event of api.streamCommitMessage(payload, {
					signal,
				})) {
					if (captureGenerationId != null) {
						streamCaptureRecorder?.recordEvent(captureGenerationId, {
							model: payload.model,
							attempt: attemptNumber,
							event,
						});
					}
					log("generate", event);
					yield event;
				}
				return;
			} catch (error) {
				if (signal?.aborted || isAbortError(error)) throw error;
				if (isInvalidCliSessionIdError(error)) {
					if (commandExecutionPromise) {
						try {
							await commandExecutionPromise;
							continue;
						} catch {
							const abortError = new Error("Aborted");
							abortError.name = "AbortError";
							throw abortError;
						}
					}
					if (attempt < maxAttempts - 1) {
						await delay(80 * (attempt + 1));
						continue;
					}
				}
				throw error;
			}
		}
		throw new Error("Failed to generate after retries.");
	};

	async function* generateForModel(
		model: string,
		slotIndex: number,
	): AsyncGenerator<CandidateWithModel> {
		try {
			if (signal?.aborted) return;
			let lastCommitMessage = "";
			let providerMetadata: unknown;
			for await (const event of generateWithRetry({
				cliSessionId: requiredCliSessionId,
				input: diff,
				model,
				hint: options.hint,
			})) {
				if (event.type === "commit-message") {
					lastCommitMessage = event.commitMessage;
					if (useStream) {
						yield {
							content: lastCommitMessage,
							slotId: model,
							model,
							isPartial: true,
							slotIndex,
						};
					}
				} else if (event.type === "provider-metadata") {
					providerMetadata = event.providerMetadata;
				} else if (event.type === "error") {
					throw new Error(event.message);
				}
			}
			if (lastCommitMessage) {
				const { generationId, cost } = extractGatewayMetadata(providerMetadata);
				yield {
					content: lastCommitMessage,
					slotId: model,
					model,
					cost,
					generationId,
					...(useStream ? { isPartial: false } : {}),
					slotIndex,
				};
			}
		} catch (error) {
			if (signal?.aborted || isAbortError(error)) return;
			if (error instanceof InvalidModelError) throw error;
			if (error instanceof InsufficientBalanceError) throw error;
			if (isInvalidCliSessionIdError(error)) throw error;
		}
	}

	const iterators = models.map((model, index) =>
		generateForModel(model, index)[Symbol.asyncIterator](),
	);

	try {
		for await (const { result } of raceAsyncIterators({
			iterators,
			signal,
			onError(index, error) {
				if (isAbortError(error) || signal?.aborted) {
					return "continue";
				}
				void index;
				return "throw";
			},
		})) {
			yield result.value;
		}
	} catch (error) {
		if (error instanceof InvalidModelError) {
			throw error;
		}
		if (error instanceof InsufficientBalanceError) {
			console.error(error.formatMessage());
			process.exit(1);
		}
		throw error;
	} finally {
		if (captureGenerationId != null) {
			streamCaptureRecorder?.finishGeneration(captureGenerationId);
		}
	}
}
