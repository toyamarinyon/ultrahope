import { classify } from "./classifier";
import { isGitDiff, parseDiff } from "./parser";
import { buildStructuredPrompt } from "./prompt-builder";
import defaultRules from "./rules/default.json";
import type { ClassificationResult, DiffRulesConfig } from "./types";

export type PreprocessResult = {
	isStructured: boolean;
	prompt: string;
	classification?: ClassificationResult;
};

export function preprocessDiff(
	input: string,
	customRules?: DiffRulesConfig,
): PreprocessResult {
	if (!isGitDiff(input)) {
		return {
			isStructured: false,
			prompt: input,
		};
	}

	const rules = customRules ?? (defaultRules as DiffRulesConfig);
	const files = parseDiff(input);
	const classification = classify(files, rules);
	const prompt = buildStructuredPrompt(classification);

	return {
		isStructured: true,
		prompt,
		classification,
	};
}
