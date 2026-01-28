import { generateText } from "ai";
import { preprocessDiff } from "./diff";
import { PROMPTS } from "./prompts";
import type { LLMResponse, Target } from "./types";

export type { LLMResponse, Target };

const VERBOSE = process.env.VERBOSE === "1";

const PRIMARY_MODEL = "cerebras/llama-3.1-8b";
const FALLBACK_MODELS = ["openai/gpt-5-nano"];

export async function translate(
	input: string,
	target: Target,
	model: string,
): Promise<LLMResponse> {
	let prompt = input;
	const selectedModel = model;

	if (target === "vcs-commit-message") {
		const preprocessed = preprocessDiff(input);
		prompt = preprocessed.prompt;
		if (VERBOSE && preprocessed.isStructured) {
			console.log("[VERBOSE] Diff preprocessed with classification");
			console.log(
				"[VERBOSE] Primary files:",
				preprocessed.classification?.primary.map((f) => f.path),
			);
		}
	}

	const providerOptions =
		selectedModel === PRIMARY_MODEL
			? {
					gateway: {
						models: FALLBACK_MODELS,
					},
				}
			: undefined;

	const result = await generateText({
		model: selectedModel,
		system: PROMPTS[target],
		prompt,
		maxOutputTokens: 1024,
		...(providerOptions ? { providerOptions } : {}),
	});

	if (VERBOSE) {
		console.log(
			"[VERBOSE] AI Gateway providerMetadata:",
			JSON.stringify(result.providerMetadata, null, 2),
		);
	}

	const metadata = result.providerMetadata?.gateway as
		| {
				routing?: { finalProvider?: string };
				cost?: string;
				marketCost?: string;
				generationId?: string;
		  }
		| undefined;
	const vendor = metadata?.routing?.finalProvider ?? "unknown";
	const costStr = metadata?.marketCost ?? metadata?.cost;
	const cost = costStr ? Number.parseFloat(costStr) : undefined;

	return {
		content: result.text,
		vendor,
		model: selectedModel,
		inputTokens: result.usage.inputTokens ?? 0,
		outputTokens: result.usage.outputTokens ?? 0,
		cost,
		generationId: metadata?.generationId,
	};
}
