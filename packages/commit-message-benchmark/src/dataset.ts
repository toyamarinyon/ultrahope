import type {
	BenchmarkAggregate,
	BenchmarkAggregateModel,
	BenchmarkDataset,
	BenchmarkModelConfig,
	BenchmarkResult,
	BenchmarkScenario,
	HumanReview,
	HumanReviewScore,
} from "./types";

export const DEFAULT_HUMAN_REVIEW: HumanReview = {
	overallScore: 3,
	notes: "Pending manual review.",
	winnerFlag: false,
};

export function reviewKey(scenarioId: string, modelId: string): string {
	return `${scenarioId}::${modelId}`;
}

export function cloneHumanReview(review: HumanReview): HumanReview {
	return {
		overallScore: review.overallScore,
		notes: review.notes,
		winnerFlag: review.winnerFlag,
	};
}

export function resolveHumanReview(review?: HumanReview): HumanReview {
	if (!review) {
		return cloneHumanReview(DEFAULT_HUMAN_REVIEW);
	}
	return cloneHumanReview(review);
}

export function createHumanReviewLookup(
	existing: BenchmarkDataset | null,
): Map<string, HumanReview> {
	const lookup = new Map<string, HumanReview>();
	if (!existing) {
		return lookup;
	}

	for (const scenario of existing.scenarios) {
		for (const result of scenario.results) {
			lookup.set(
				reviewKey(scenario.id, result.modelId),
				cloneHumanReview(result.humanReview),
			);
		}
	}

	return lookup;
}

function average(values: number[], precision: number): number | null {
	if (values.length === 0) {
		return null;
	}
	const factor = 10 ** precision;
	const rawAverage =
		values.reduce((sum, value) => sum + value, 0) / values.length;
	return Math.round(rawAverage * factor) / factor;
}

function toScoreAverage(scores: HumanReviewScore[]): number {
	if (scores.length === 0) {
		return DEFAULT_HUMAN_REVIEW.overallScore;
	}
	const rawAverage =
		scores.reduce((sum, value) => sum + value, 0) / scores.length;
	return Math.round(rawAverage * 100) / 100;
}

function buildModelAggregate(args: {
	model: BenchmarkModelConfig;
	scenarios: BenchmarkScenario[];
}): BenchmarkAggregateModel {
	const modelResults = args.scenarios
		.flatMap((scenario) => scenario.results)
		.filter((result) => result.modelId === args.model.id);

	const successResults = modelResults.filter(
		(result) => result.status === "success",
	);
	const latencyValues = successResults
		.map((result) => result.latencyMs)
		.filter((value): value is number => value != null);
	const costValues = successResults
		.map((result) => result.costUsd)
		.filter((value): value is number => value != null);
	const scoreValues = modelResults.map(
		(result) => result.humanReview.overallScore,
	);

	return {
		modelId: args.model.id,
		tier: args.model.tier,
		successCount: successResults.length,
		errorCount: modelResults.length - successResults.length,
		avgLatencyMs: average(latencyValues, 2),
		avgCostUsd: average(costValues, 7),
		avgScore: toScoreAverage(scoreValues),
	};
}

function pickTopModelId(
	byModel: BenchmarkAggregateModel[],
	tier: BenchmarkModelConfig["tier"],
): string | null {
	const candidates = byModel.filter((entry) => entry.tier === tier);
	if (candidates.length === 0) {
		return null;
	}
	candidates.sort((a, b) => {
		if (a.avgScore !== b.avgScore) {
			return b.avgScore - a.avgScore;
		}
		if (a.errorCount !== b.errorCount) {
			return a.errorCount - b.errorCount;
		}
		if (a.avgLatencyMs == null && b.avgLatencyMs != null) {
			return 1;
		}
		if (a.avgLatencyMs != null && b.avgLatencyMs == null) {
			return -1;
		}
		if (a.avgLatencyMs != null && b.avgLatencyMs != null) {
			return a.avgLatencyMs - b.avgLatencyMs;
		}
		return a.modelId.localeCompare(b.modelId);
	});

	return candidates[0]?.modelId ?? null;
}

export function buildAggregate(args: {
	models: BenchmarkModelConfig[];
	scenarios: BenchmarkScenario[];
}): BenchmarkAggregate {
	const byModel = args.models.map((model) =>
		buildModelAggregate({ model, scenarios: args.scenarios }),
	);

	return {
		byModel,
		smallTopModelId: pickTopModelId(byModel, "small"),
		frontierTopModelId: pickTopModelId(byModel, "frontier"),
	};
}

export function assertDatasetShape(dataset: BenchmarkDataset): void {
	if (!dataset.generatedAt) {
		throw new Error("Dataset validation failed: generatedAt is required.");
	}
	if (!dataset.provider) {
		throw new Error("Dataset validation failed: provider is required.");
	}
	if (!Array.isArray(dataset.models) || dataset.models.length === 0) {
		throw new Error("Dataset validation failed: models must be non-empty.");
	}
	if (!Array.isArray(dataset.scenarios) || dataset.scenarios.length === 0) {
		throw new Error("Dataset validation failed: scenarios must be non-empty.");
	}

	for (const scenario of dataset.scenarios) {
		if (!scenario.id || !scenario.title || !scenario.diff) {
			throw new Error(
				`Dataset validation failed: scenario fields missing for ${scenario.id}.`,
			);
		}

		for (const result of scenario.results) {
			if (!result.modelId || !result.tier) {
				throw new Error(
					`Dataset validation failed: result model fields missing for ${scenario.id}.`,
				);
			}
			if (result.status !== "success" && result.status !== "error") {
				throw new Error(
					`Dataset validation failed: invalid status for ${scenario.id}/${result.modelId}.`,
				);
			}
			if (
				result.humanReview.overallScore < 1 ||
				result.humanReview.overallScore > 5
			) {
				throw new Error(
					`Dataset validation failed: invalid score for ${scenario.id}/${result.modelId}.`,
				);
			}
		}
	}

	if (!dataset.aggregate || !Array.isArray(dataset.aggregate.byModel)) {
		throw new Error(
			"Dataset validation failed: aggregate.byModel is required.",
		);
	}
}

export function normalizeCommitMessage(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

export function sanitizeCommitMessageWrappers(text: string): string {
	return text.replace(/^`+|`+$/g, "");
}

export function withSortedResults(
	results: BenchmarkResult[],
): BenchmarkResult[] {
	return [...results].sort((a, b) => a.modelId.localeCompare(b.modelId));
}
