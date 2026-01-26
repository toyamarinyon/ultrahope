import { createApiClient, InsufficientBalanceError } from "./api-client";
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
}

export async function* generateCommitMessages(
	options: GeneratorOptions,
): AsyncGenerator<CandidateWithModel> {
	const { diff, models, mock = false } = options;

	if (mock) {
		const api = createMockApiClient();
		for (const model of models) {
			const result = await api.translate({
				input: diff,
				target: "vcs-commit-message",
			});
			yield { content: result.output, model };
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
				const result = await api.translate({
					input: diff,
					target: "vcs-commit-message",
				});
				return {
					result: {
						content: result.output,
						model,
					},
					index,
				};
			} catch (error) {
				if (error instanceof InsufficientBalanceError) {
					throw error;
				}
				return { result: null, index };
			}
		})(),
		index,
	}));

	const remaining = new Map(pending.map((p) => [p.index, p.promise]));

	try {
		while (remaining.size > 0) {
			const { result, index } = await Promise.race(remaining.values());
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
