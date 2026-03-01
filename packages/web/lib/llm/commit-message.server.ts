import {
	type CommitMessageRefineRuntimeOptions as CommitMessageRefineServerBaseOptions,
	type CommitMessageRefineRuntimeStreamOptions as CommitMessageRefineServerStreamOptions,
	type CommitMessageRuntimeResult,
	type CommitMessageRuntimeOptions as CommitMessageServerBaseOptions,
	type CommitMessageRuntimeStreamOptions as CommitMessageServerStreamOptions,
	generateCommitMessage as generateCommitMessageCore,
	generateCommitMessageRefine as generateCommitMessageRefineCore,
	generateCommitMessageRefineStream as generateCommitMessageRefineStreamCore,
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

export type GenerateCommitMessageRefineOptions = Omit<
	CommitMessageRefineServerBaseOptions,
	"model"
> & {
	model: LanguageModel;
};

export type GenerateCommitMessageRefineStreamOptions = Omit<
	CommitMessageRefineServerStreamOptions,
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
		guide: options.guide,
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
			guide: options.guide,
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

export function generateCommitMessageRefineStream(
	options: GenerateCommitMessageRefineStreamOptions,
) {
	const resolvedModel = resolveModel(options.model);
	return generateCommitMessageRefineStreamCore({
		...options,
		model: resolvedModel,
	});
}

export async function generateCommitMessageRefine(
	options: GenerateCommitMessageRefineOptions,
): Promise<LLMResponse> {
	const resolvedModel = resolveModel(options.model);
	const result: CommitMessageRuntimeResult =
		await generateCommitMessageRefineCore({
			...options,
			model: resolvedModel,
		});

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
