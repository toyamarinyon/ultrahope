import {
	createApiClient,
	type GenerateResponse,
	type GenerateStreamResponse,
	InsufficientBalanceError,
} from "./api-client";
import { getToken } from "./auth";
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

	const generateWithRetry = async (payload: {
		cliSessionId: string;
		input: string;
		model: string;
	}): Promise<GenerateResponse | GenerateStreamResponse> => {
		const maxAttempts = 3;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				return useStream
					? await api.generateCommitMessageStream(payload, { signal })
					: await api.generateCommitMessage(payload, { signal });
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

	type PendingResult = {
		promise: Promise<{ result: CandidateWithModel | null; index: number }>;
		index: number;
	};

	const pending: PendingResult[] = models.map((model, index) => ({
		promise: (async () => {
			try {
				if (signal?.aborted) {
					return { result: null, index };
				}
				const result = await generateWithRetry({
					cliSessionId,
					input: diff,
					model,
				});
				return {
					result: {
						content: result.output,
						model,
						cost: result.cost,
						generationId: result.generationId,
						quota: result.quota,
					},
					index,
				};
			} catch (error) {
				if (signal?.aborted || isAbortError(error)) {
					return { result: null, index };
				}
				if (error instanceof InsufficientBalanceError) {
					throw error;
				}
				if (isInvalidCliSessionIdError(error)) {
					throw error;
				}
				return { result: null, index };
			}
		})(),
		index,
	}));

	const remaining = new Map(pending.map((p) => [p.index, p.promise]));
	const abortPromise = signal
		? new Promise<null>((resolve) => {
				if (signal.aborted) {
					resolve(null);
					return;
				}
				signal.addEventListener("abort", () => resolve(null), { once: true });
			})
		: null;

	try {
		while (remaining.size > 0) {
			if (signal?.aborted) break;
			const next = Promise.race(remaining.values());
			const winner = abortPromise
				? await Promise.race([next, abortPromise])
				: await next;
			if (!winner || signal?.aborted) break;
			const { result, index } = winner;
			remaining.delete(index);
			if (result) yield result;
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
