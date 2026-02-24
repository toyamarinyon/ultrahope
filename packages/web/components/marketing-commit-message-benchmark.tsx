"use client";

import { useMemo, useState } from "react";
import benchmarkDatasetJson from "@/lib/demo/commit-message-benchmark.dataset.json";

type BenchmarkTier = "small" | "frontier";

type HumanReview = {
	overallScore: 1 | 2 | 3 | 4 | 5;
	notes: string;
	winnerFlag: boolean;
};

type BenchmarkSortMode = "latencyThenCost" | "costThenLatency";

type BenchmarkResult = {
	modelId: string;
	tier: BenchmarkTier;
	status: "success" | "error";
	message: string;
	latencyMs: number | null;
	costUsd: number | null;
	inputTokens: number;
	outputTokens: number;
	humanReview: HumanReview;
	errorMessage?: string;
};

type BenchmarkScenario = {
	id: string;
	title: string;
	sourceRepo: string;
	sourceCommitUrl: string;
	diff: string;
	results: BenchmarkResult[];
};

type BenchmarkDataset = {
	generatedAt: string;
	provider: string;
	models: Array<{
		id: string;
		tier: BenchmarkTier;
		label: string;
	}>;
	scenarios: BenchmarkScenario[];
};

const benchmarkDataset = benchmarkDatasetJson as BenchmarkDataset;

function countDiffStats(diff: string): {
	additions: number;
	deletions: number;
} {
	let additions = 0;
	let deletions = 0;

	for (const line of diff.split("\n")) {
		if (line.startsWith("+++ ") || line.startsWith("--- ")) {
			continue;
		}
		if (line.startsWith("+")) {
			additions += 1;
			continue;
		}
		if (line.startsWith("-")) {
			deletions += 1;
		}
	}

	return { additions, deletions };
}

function formatShortCommitHash(sourceCommitUrl: string): string {
	const commitPathMatch = sourceCommitUrl.match(
		/\/commit\/([0-9a-fA-F]{7,40})/,
	);
	if (commitPathMatch) {
		return commitPathMatch[1].slice(0, 7);
	}

	const tailHashMatch = sourceCommitUrl.match(/([0-9a-fA-F]{7,40})\/?$/);
	if (tailHashMatch) {
		return tailHashMatch[1].slice(0, 7);
	}

	return "unknown";
}

function formatCost(costUsd: number | null): string {
	if (costUsd == null) {
		return "n/a";
	}
	return `$${costUsd.toFixed(5)}`;
}

function formatLatency(latencyMs: number | null): string {
	if (latencyMs == null) {
		return "n/a";
	}
	return `${Math.round(latencyMs)}ms`;
}

function safeMetric(value: number | null): number {
	return value ?? Number.POSITIVE_INFINITY;
}

function isSuccessful(result: BenchmarkResult): boolean {
	return result.status === "success";
}

function formatModelName(
	modelId: string,
	modelLabelMap: Map<string, string>,
): string {
	return modelLabelMap.get(modelId) ?? modelId;
}

export function MarketingCommitMessageBenchmark() {
	const scenarios = benchmarkDataset.scenarios;
	const [activeScenarioId, setActiveScenarioId] = useState(
		scenarios[0]?.id ?? "",
	);
	const [sortMode, setSortMode] =
		useState<BenchmarkSortMode>("latencyThenCost");
	const modelLabelMap = useMemo(
		() =>
			new Map(benchmarkDataset.models.map((model) => [model.id, model.label])),
		[],
	);
	const scenarioDiffStatsMap = useMemo(
		() =>
			new Map(
				scenarios.map((scenario) => [
					scenario.id,
					countDiffStats(scenario.diff),
				]),
			),
		[scenarios],
	);

	const activeScenario =
		scenarios.find((scenario) => scenario.id === activeScenarioId) ??
		scenarios[0];

	if (!activeScenario) {
		return (
			<div className="bg-slate-50/5 w-full h-100 flex items-center justify-center">
				Benchmark dataset is unavailable.
			</div>
		);
	}

	const orderedResults = [...activeScenario.results].sort((a, b) => {
		const aSuccessful = isSuccessful(a);
		const bSuccessful = isSuccessful(b);

		if (aSuccessful !== bSuccessful) {
			return aSuccessful ? -1 : 1;
		}

		if (sortMode === "costThenLatency") {
			const aCost = safeMetric(a.costUsd);
			const bCost = safeMetric(b.costUsd);
			if (aCost !== bCost) {
				return aCost - bCost;
			}

			const aLatency = safeMetric(a.latencyMs);
			const bLatency = safeMetric(b.latencyMs);
			if (aLatency !== bLatency) {
				return aLatency - bLatency;
			}
		} else {
			const aLatency = safeMetric(a.latencyMs);
			const bLatency = safeMetric(b.latencyMs);
			if (aLatency !== bLatency) {
				return aLatency - bLatency;
			}

			const aCost = safeMetric(a.costUsd);
			const bCost = safeMetric(b.costUsd);
			if (aCost !== bCost) {
				return aCost - bCost;
			}
		}

		return a.modelId.localeCompare(b.modelId);
	});

	return (
		<div className="sm:p-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p className="text-xs uppercase tracking-[0.18em] text-foreground-muted">
						How much intelligence does this task actually need?
					</p>
					<h3 className="mt-1 text-xl font-semibold">
						We measured latency, cost, and output quality on real commit diffs.
					</h3>
				</div>
				<div className="w-full sm:w-auto">
					<label
						htmlFor="benchmark-sort-select"
						className="text-xs uppercase tracking-[0.14em] text-foreground-muted"
					>
						Sort by
					</label>
					<select
						id="benchmark-sort-select"
						value={sortMode}
						onChange={(event) =>
							setSortMode(event.target.value as BenchmarkSortMode)
						}
						className="mt-2 w-full sm:w-64 rounded-md bg-canvas-dark/70 px-3 py-2 text-sm text-foreground ring-1 ring-border-subtle/60 outline-none focus:ring-foreground/40"
					>
						<option value="latencyThenCost">Latency, then cost</option>
						<option value="costThenLatency">Cost, then latency</option>
					</select>
				</div>
			</div>

			<div className="mt-4 lg:hidden">
				<label
					htmlFor="benchmark-scenario-select"
					className="text-xs uppercase tracking-[0.14em] text-foreground-muted"
				>
					Sample
				</label>
				<select
					id="benchmark-scenario-select"
					value={activeScenario.id}
					onChange={(event) => setActiveScenarioId(event.target.value)}
					className="mt-2 w-full rounded-md bg-canvas-dark/70 px-3 py-2 text-sm text-foreground ring-1 ring-border-subtle/60 outline-none focus:ring-foreground/40"
				>
					{scenarios.map((scenario) => {
						const stats = scenarioDiffStatsMap.get(scenario.id);
						const shortCommitHash = formatShortCommitHash(
							scenario.sourceCommitUrl,
						);
						return (
							<option key={scenario.id} value={scenario.id}>
								{scenario.sourceRepo}#{shortCommitHash} · +
								{stats?.additions ?? 0} -{stats?.deletions ?? 0}
							</option>
						);
					})}
				</select>
			</div>

			<p className="mt-5 hidden text-xs uppercase tracking-[0.14em] text-foreground-muted lg:block">
				Samples
			</p>

			<div className="mt-3 grid gap-5 lg:grid-cols-[0.95fr_1.45fr] lg:items-stretch">
				<section className="hidden lg:relative lg:block lg:min-h-0 lg:overflow-hidden">
					<div className="flex flex-col gap-2 pr-1 lg:absolute lg:inset-0 lg:overflow-y-auto">
						{scenarios.map((scenario) => {
							const isActive = scenario.id === activeScenario.id;
							const stats = scenarioDiffStatsMap.get(scenario.id);
							const shortCommitHash = formatShortCommitHash(
								scenario.sourceCommitUrl,
							);
							return (
								<button
									key={scenario.id}
									type="button"
									onClick={() => setActiveScenarioId(scenario.id)}
									className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
										isActive
											? "border-foreground/60 bg-canvas-dark text-foreground"
											: "border-border-subtle/70 text-foreground-muted hover:border-foreground/30 hover:text-foreground"
									}`}
								>
									<div className="flex items-center justify-between gap-2">
										<p className="text-xs text-foreground-muted">
											{scenario.sourceRepo}#{shortCommitHash} · +
											{stats?.additions ?? 0} -{stats?.deletions ?? 0}
										</p>
									</div>
									<p className="mt-1 text-sm text-foreground">
										{scenario.title}
									</p>
								</button>
							);
						})}
					</div>
				</section>

				<section className="lg:min-h-0 lg:pl-2">
					<div className="overflow-x-auto rounded-lg border border-border-subtle/70">
						<table className="w-full min-w-190 border-collapse text-left text-sm">
							<thead className="bg-canvas-dark/70 text-[11px] uppercase tracking-[0.12em] text-foreground-muted">
								<tr>
									<th className="px-3 py-2 font-medium">Model</th>
									<th className="px-3 py-2 font-medium">Message</th>
									<th className="px-3 py-2 font-medium">Latency</th>
									<th className="px-3 py-2 text-right font-medium">Cost</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border-subtle/60 bg-canvas-dark/30">
								{orderedResults.map((result) => {
									return (
										<tr key={result.modelId}>
											<td className="px-3 py-3 align-top">
												<p className="font-medium text-foreground">
													{formatModelName(result.modelId, modelLabelMap)}
												</p>
												<p className="text-[11px] text-foreground-muted">
													{result.modelId}
												</p>
											</td>
											<td className="px-3 py-3 align-top">
												<p
													className={
														result.status === "success"
															? "text-foreground"
															: "text-rose-200"
													}
												>
													{result.status === "success"
														? result.message
														: `Generation failed: ${result.errorMessage ?? "unknown error"}`}
												</p>
											</td>
											<td className="px-3 py-3 align-top text-foreground">
												{formatLatency(result.latencyMs)}
											</td>
											<td className="px-3 py-3 align-top text-right tabular-nums text-foreground">
												{formatCost(result.costUsd)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</section>
			</div>

			<p className="mt-4 text-xs text-foreground-muted">
				Quality scores are manually reviewed by humans. Latency and cost are
				captured from the same AI Gateway execution.
			</p>
		</div>
	);
}
