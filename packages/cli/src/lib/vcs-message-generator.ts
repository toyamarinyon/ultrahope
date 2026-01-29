import {
	createApiClient,
	InsufficientBalanceError,
	type TranslateResponse,
} from "./api-client";
import { getToken } from "./auth";
import { createMockApiClient } from "./mock-api-client";
import type { CandidateWithModel } from "./selector";

export const DEFAULT_MODELS = [
	"mistral/mistral-nemo",
	"cerebras/llama-3.1-8b",
	"openai/gpt-5-nano",
	"xai/grok-code-fast-1",
];

export interface GeneratorOptions {
	diff: string;
	models: string[];
	mock?: boolean;
	signal?: AbortSignal;
	commandExecutionId?: string;
}

export async function* generateCommitMessages(
	options: GeneratorOptions,
): AsyncGenerator<CandidateWithModel> {
	const { diff, models, mock = false, signal, commandExecutionId } = options;
	const effectiveCommandExecutionId =
		commandExecutionId ?? (mock ? "mock-command-execution" : undefined);

	if (!effectiveCommandExecutionId) {
		throw new Error("Missing commandExecutionId for translate request.");
	}

	const isAbortError = (error: unknown) =>
		error instanceof Error && error.name === "AbortError";

	if (mock) {
		const api = createMockApiClient();
		for (const model of models) {
			if (signal?.aborted) return;
			let result: TranslateResponse;
			try {
				result = await api.translate(
					{
						commandExecutionId: effectiveCommandExecutionId,
						input: diff,
						model,
						target: "vcs-commit-message",
					},
					{ signal },
				);
			} catch (error) {
				if (signal?.aborted || isAbortError(error)) return;
				throw error;
			}
			if (signal?.aborted) return;
			yield {
				content: result.output,
				model,
				generationId: result.generationId,
			};
		}
		return;
	}

	const token = await getToken();
	if (!token) {
		console.error("Error: Not authenticated. Run `ultrahope login` first.");
		process.exit(1);
	}

	const api = createApiClient(token);

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
				const result = await api.translate(
					{
						commandExecutionId: effectiveCommandExecutionId,
						input: diff,
						model,
						target: "vcs-commit-message",
					},
					{ signal },
				);
				return {
					result: {
						content: result.output,
						model,
						cost: result.cost,
						generationId: result.generationId,
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
