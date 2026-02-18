import {
	type CommitMessageRuntimeResult,
	type CommitMessageRuntimeOptions as CommitMessageServerBaseOptions,
	type CommitMessageRuntimeStreamOptions as CommitMessageServerStreamOptions,
	generateCommitMessage as generateCommitMessageCore,
	generateCommitMessageStream as generateCommitMessageStreamCore,
} from "./commit-message";
import { buildResponse, resolveModel } from "./llm-utils";
import type { LanguageModel, LLMResponse } from "./types";

export type GenerateCommitMessageOptions = Omit<
	CommitMessageServerBaseOptions,
	"model"
> & {
	model: LanguageModel;
};

export type GenerateCommitMessageStreamOptions = Omit<
	CommitMessageServerStreamOptions,
	"model"
> & {
	model: LanguageModel;
};

export function generateCommitMessageStream(
	diff: string,
	options: GenerateCommitMessageStreamOptions,
) {
	const resolvedModel = resolveModel(options.model);
	return generateCommitMessageStreamCore(diff, {
		model: resolvedModel,
		abortSignal: options.abortSignal,
	});
}

export async function generateCommitMessage(
	diff: string,
	options: GenerateCommitMessageOptions,
): Promise<LLMResponse> {
	const resolvedModel = resolveModel(options.model);
	const result: CommitMessageRuntimeResult = await generateCommitMessageCore(
		diff,
		{
			model: resolvedModel,
			abortSignal: options.abortSignal,
		},
	);

	return buildResponse(
		{
			text: result.text,
			usage: {
				inputTokens: result.usage.inputTokens,
				outputTokens: result.usage.outputTokens,
			},
			providerMetadata: result.providerMetadata,
		},
		options.model,
	);
}
