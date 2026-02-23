"use client";

import { useMemo, useState } from "react";
import benchmarkDatasetJson from "@/lib/demo/commit-message-benchmark.dataset.json";

type BenchmarkTier = "small" | "frontier";

type HumanReview = {
	overallScore: 1 | 2 | 3 | 4 | 5;
	notes: string;
	winnerFlag: boolean;
};

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

function formatCost(costUsd: number | null): string {
	if (costUsd == null) {
		return "n/a";
	}
	return `$${costUsd.toFixed(7).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function formatLatency(latencyMs: number | null): string {
	if (latencyMs == null) {
		return "n/a";
	}
	if (latencyMs < 1000) {
		return `${Math.round(latencyMs)}ms`;
	}
	const seconds = (latencyMs / 1000)
		.toFixed(2)
		.replace(/0+$/, "")
		.replace(/\.$/, "");
	return `${seconds}s`;
}

function resolveSmallTopModelId(results: BenchmarkResult[]): string | null {
	const smallResults = results.filter((result) => result.tier === "small");
	if (smallResults.length === 0) {
		return null;
	}

	const winner = smallResults.find(
		(result) => result.status === "success" && result.humanReview.winnerFlag,
	);
	if (winner) {
		return winner.modelId;
	}

	return [...smallResults].sort((a, b) => {
		if (a.humanReview.overallScore !== b.humanReview.overallScore) {
			return b.humanReview.overallScore - a.humanReview.overallScore;
		}
		if (a.status !== b.status) {
			return a.status === "success" ? -1 : 1;
		}
		return a.modelId.localeCompare(b.modelId);
	})[0]?.modelId;
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
	const modelLabelMap = useMemo(
		() =>
			new Map(benchmarkDataset.models.map((model) => [model.id, model.label])),
		[],
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

	const smallTopModelId = resolveSmallTopModelId(activeScenario.results);
	const diffPreview = activeScenario.diff.split("\n").slice(0, 20).join("\n");

	return (
		<div className="rounded-2xl border border-border-subtle bg-canvas-dark/60 p-4 sm:p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-xs uppercase tracking-[0.18em] text-foreground-muted">
						Pre-generated benchmark
					</p>
					<h3 className="mt-1 text-xl font-semibold">
						Small models vs frontier models on commit messages
					</h3>
				</div>
				<p className="text-xs text-foreground-muted">
					Generated at {new Date(benchmarkDataset.generatedAt).toLocaleString()}
				</p>
			</div>

			<div
				className="mt-4 flex flex-wrap gap-2"
				role="tablist"
				aria-label="Commit message benchmark scenarios"
			>
				{scenarios.map((scenario) => {
					const isActive = scenario.id === activeScenario.id;
					return (
						<button
							key={scenario.id}
							type="button"
							onClick={() => setActiveScenarioId(scenario.id)}
							role="tab"
							aria-selected={isActive}
							className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
								isActive
									? "border-foreground/50 bg-surface-hover text-foreground"
									: "border-border-subtle text-foreground-muted hover:text-foreground"
							}`}
						>
							{scenario.title}
						</button>
					);
				})}
			</div>

			<div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.45fr]">
				<section className="rounded-xl border border-border-subtle bg-canvas-dark p-3">
					<div className="flex items-center justify-between gap-2">
						<p className="text-xs text-foreground-muted">Diff preview</p>
						<a
							href={activeScenario.sourceCommitUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-foreground-muted hover:text-foreground"
						>
							{activeScenario.sourceRepo}
						</a>
					</div>
					<pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-[11px] text-foreground-secondary">
						{diffPreview}
					</pre>
				</section>

				<section className="grid gap-3 sm:grid-cols-2">
					{activeScenario.results.map((result) => {
						const isSmallTop =
							result.tier === "small" && result.modelId === smallTopModelId;

						return (
							<article
								key={result.modelId}
								className={`rounded-xl border p-3 ${
									isSmallTop
										? "border-amber-300/70 bg-amber-500/5"
										: "border-border-subtle bg-canvas-dark"
								}`}
							>
								<div className="flex items-start justify-between gap-2">
									<div>
										<p className="text-sm font-medium text-foreground">
											{formatModelName(result.modelId, modelLabelMap)}
										</p>
										<p className="text-[11px] text-foreground-muted">
											{result.modelId}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<span
											className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
												result.tier === "small"
													? "bg-foreground/10 text-foreground-secondary"
													: "bg-foreground/20 text-foreground"
											}`}
										>
											{result.tier}
										</span>
										{isSmallTop && (
											<span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-200">
												top small
											</span>
										)}
									</div>
								</div>

								{result.status === "success" ? (
									<p className="mt-3 rounded-md bg-surface/50 px-2 py-2 text-sm text-foreground">
										{result.message}
									</p>
								) : (
									<p className="mt-3 rounded-md bg-rose-500/10 px-2 py-2 text-sm text-rose-200">
										Generation failed: {result.errorMessage ?? "unknown error"}
									</p>
								)}

								<div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
									<div className="rounded-md border border-border-subtle px-2 py-1">
										<p className="text-foreground-muted">Latency</p>
										<p className="text-foreground">
											{formatLatency(result.latencyMs)}
										</p>
									</div>
									<div className="rounded-md border border-border-subtle px-2 py-1">
										<p className="text-foreground-muted">Cost</p>
										<p className="text-foreground">
											{formatCost(result.costUsd)}
										</p>
									</div>
									<div className="rounded-md border border-border-subtle px-2 py-1">
										<p className="text-foreground-muted">Human score</p>
										<p className="text-foreground">
											{result.humanReview.overallScore}/5
										</p>
									</div>
								</div>
								<p className="mt-2 text-[11px] text-foreground-muted">
									{result.humanReview.notes}
								</p>
							</article>
						);
					})}
				</section>
			</div>

			<p className="mt-4 text-xs text-foreground-muted">
				Quality scores are manually reviewed by humans. Latency and cost are
				captured from the same AI Gateway execution.
			</p>
		</div>
	);
}
