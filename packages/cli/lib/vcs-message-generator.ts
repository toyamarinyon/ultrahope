import {
	type CommitMessageStreamEvent,
	createApiClient,
	extractGatewayMetadata,
	InsufficientBalanceError,
} from "./api-client";
import { getToken } from "./auth";
import { log } from "./logger";
import type { CandidateWithModel } from "./selector";

export const DEFAULT_MODELS = [
	"mistral/ministral-3b",
	// "cerebras/qwen-3-235b",
	// "openai/gpt-5.1",
	"xai/grok-code-fast-1",
];

export interface GeneratorOptions {
	diff: string;
	models: string[];
	signal?: AbortSignal;
	cliSessionId?: string;
	commandExecutionPromise?: Promise<unknown>;
	useStream?: boolean;
}

const isAbortError = (error: unknown) =>
	error instanceof Error && error.name === "AbortError";

const isInvalidCliSessionIdError = (error: unknown) =>
	error instanceof Error && error.message.includes("Invalid cliSessionId");

const delay = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

const createAbortPromise = (signal?: AbortSignal) =>
	signal
		? new Promise<null>((resolve) => {
				if (signal.aborted) {
					resolve(null);
					return;
				}
				signal.addEventListener("abort", () => resolve(null), { once: true });
			})
		: null;

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
	} = options;

	if (!cliSessionId) {
		throw new Error("Missing cliSessionId for generate request.");
	}

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
	}): AsyncGenerator<CommitMessageStreamEvent> {
		const maxAttempts = 3;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				for await (const event of api.streamCommitMessage(payload, {
					signal,
				})) {
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
				cliSessionId,
				input: diff,
				model,
			})) {
				if (event.type === "commit-message") {
					lastCommitMessage = event.commitMessage;
					if (useStream) {
						yield {
							content: lastCommitMessage,
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
					model,
					cost,
					generationId,
					...(useStream ? { isPartial: false, slotIndex } : {}),
				};
			}
		} catch (error) {
			if (signal?.aborted || isAbortError(error)) return;
			if (error instanceof InsufficientBalanceError) throw error;
			if (isInvalidCliSessionIdError(error)) throw error;
		}
	}

	type PendingNext = {
		iterator: AsyncIterator<CandidateWithModel>;
		promise: Promise<{
			result: IteratorResult<CandidateWithModel>;
			index: number;
		}>;
		index: number;
	};

	const iterators = models.map((model, index) => ({
		iterator: generateForModel(model, index)[Symbol.asyncIterator](),
		index,
	}));

	const pending = new Map<number, PendingNext>();

	const startNext = (it: {
		iterator: AsyncIterator<CandidateWithModel>;
		index: number;
	}) => {
		const promise = it.iterator.next().then((result) => ({
			result,
			index: it.index,
		}));
		pending.set(it.index, {
			iterator: it.iterator,
			promise,
			index: it.index,
		});
	};

	for (const it of iterators) {
		startNext(it);
	}

	const abortPromise = createAbortPromise(signal);

	try {
		while (pending.size > 0) {
			if (signal?.aborted) break;
			const next = Promise.race(
				Array.from(pending.values()).map((p) => p.promise),
			);
			const winner = abortPromise
				? await Promise.race([next, abortPromise])
				: await next;
			if (!winner || signal?.aborted) break;
			const { result, index } = winner;
			const entry = pending.get(index);
			if (!entry) continue;
			if (result.done) {
				pending.delete(index);
			} else {
				yield result.value;
				startNext({ iterator: entry.iterator, index });
			}
		}
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
