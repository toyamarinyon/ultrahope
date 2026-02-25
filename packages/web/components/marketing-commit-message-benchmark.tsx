"use client";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { type CSSProperties, useMemo, useState } from "react";
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

const horizontalScrollFadeStyle: CSSProperties = {
	maskImage:
		"linear-gradient(to right, transparent 0, black min(3.5rem, var(--scroll-area-overflow-x-start)), black calc(100% - min(3.5rem, var(--scroll-area-overflow-x-end))), transparent 100%)",
	maskRepeat: "no-repeat",
	maskSize: "100% 100%",
	WebkitMaskImage:
		"linear-gradient(to right, transparent 0, black min(3.5rem, var(--scroll-area-overflow-x-start)), black calc(100% - min(3.5rem, var(--scroll-area-overflow-x-end))), transparent 100%)",
	WebkitMaskRepeat: "no-repeat",
	WebkitMaskSize: "100% 100%",
};

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
					{/*<p className="text-foreground-muted">
						How Much Model Do You Actually Need?
					</p>*/}
					<h3 className="mt-1 text-xl">
						Take commit messages. Here's what different models generate from the
						same diff
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

			<p className="mt-5 text-xs uppercase tracking-[0.14em] text-foreground-muted">
				Samples
			</p>

			<div className="mt-3 flex flex-col gap-5">
				<section className="min-h-0">
					<ScrollArea.Root>
						<ScrollArea.Viewport style={horizontalScrollFadeStyle}>
							<ScrollArea.Content className="inline-flex gap-2 pb-1">
								{scenarios.map((scenario) => {
									const isActive = scenario.id === activeScenario.id;
									const stats = scenarioDiffStatsMap.get(scenario.id);
									const shortCommitHash = formatShortCommitHash(
										scenario.sourceCommitUrl,
									);
									return (
										<div
											key={scenario.id}
											className="group relative flex w-80 shrink-0"
										>
											<button
												type="button"
												onClick={() => setActiveScenarioId(scenario.id)}
												className={`flex h-full w-full flex-col justify-start rounded-lg border px-3 py-2 pr-10 text-left transition-colors ${
													isActive
														? "border-foreground/60 bg-canvas-dark text-foreground"
														: "border-border-subtle/70 text-foreground-muted hover:border-foreground/30 hover:text-foreground"
												}`}
											>
												<div className="flex items-center justify-between gap-2">
													<p className="text-xs text-foreground-muted wrap-break-words">
														{scenario.sourceRepo}#{shortCommitHash} · +
														{stats?.additions ?? 0} -{stats?.deletions ?? 0}
													</p>
												</div>
												<p
													className="text-sm text-foreground wrap-break-words overflow-hidden"
													style={{
														display: "-webkit-box",
														WebkitLineClamp: 2,
														WebkitBoxOrient: "vertical",
													}}
												>
													{scenario.title}
												</p>
											</button>
											<a
												href={scenario.sourceCommitUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="pointer-events-none absolute top-2 right-2 inline-flex size-6 items-center justify-center rounded-md text-foreground-muted opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 hover:text-foreground"
												aria-label={`Open commit ${shortCommitHash} on GitHub`}
												title="Open commit on GitHub"
											>
												<span className="sr-only">
													Open commit {shortCommitHash} on GitHub
												</span>
												<svg
													width="14"
													height="14"
													viewBox="0 0 16 16"
													fill="none"
													aria-hidden="true"
												>
													<path
														d="M9 3.5H12.5V7"
														stroke="currentColor"
														strokeWidth="1.5"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
													<path
														d="M8 8L12.5 3.5"
														stroke="currentColor"
														strokeWidth="1.5"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
													<rect
														x="3"
														y="5.5"
														width="7.5"
														height="7.5"
														rx="1.5"
														stroke="currentColor"
														strokeWidth="1.5"
													/>
												</svg>
											</a>
										</div>
									);
								})}
							</ScrollArea.Content>
						</ScrollArea.Viewport>
					</ScrollArea.Root>
				</section>

				<section className="min-h-0">
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
