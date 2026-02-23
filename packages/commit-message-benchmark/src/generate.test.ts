import { describe, expect, it } from "bun:test";
import {
	assertDatasetShape,
	buildAggregate,
	createHumanReviewLookup,
	resolveHumanReview,
	reviewKey,
} from "./dataset";
import {
	createExistingScenarioLookup,
	parseGenerateCliArgs,
	parseGitHubRepoInput,
	shouldReuseExistingResult,
	toErrorResult,
	toReusedResult,
} from "./generate";
import { BENCHMARK_MODELS } from "./models";
import type { BenchmarkDataset, BenchmarkScenario } from "./types";

describe("commit-message benchmark dataset helpers", () => {
	it("validates a well-formed dataset", () => {
		const scenario: BenchmarkScenario = {
			id: "scenario-1",
			title: "Scenario",
			sourceRepo: "facebook/react",
			sourceCommitUrl: "https://github.com/facebook/react/commit/abc",
			diff: "diff --git a/a b/a",
			results: [
				{
					modelId: BENCHMARK_MODELS[0].id,
					tier: "small",
					status: "success",
					message: "fix(web): keep value sync",
					latencyMs: 120,
					costUsd: 0.00012,
					inputTokens: 10,
					outputTokens: 5,
					humanReview: {
						overallScore: 4,
						notes: "Clear and accurate.",
						winnerFlag: true,
					},
					providerMetadata: null,
				},
			],
		};

		const dataset: BenchmarkDataset = {
			generatedAt: new Date().toISOString(),
			provider: "vercel-ai-gateway",
			models: [BENCHMARK_MODELS[0]],
			scenarios: [scenario],
			aggregate: buildAggregate({
				models: [BENCHMARK_MODELS[0]],
				scenarios: [scenario],
			}),
		};

		expect(() => assertDatasetShape(dataset)).not.toThrow();
	});

	it("preserves existing humanReview values", () => {
		const existing: BenchmarkDataset = {
			generatedAt: new Date().toISOString(),
			provider: "vercel-ai-gateway",
			models: [BENCHMARK_MODELS[0]],
			scenarios: [
				{
					id: "react-input-defaultchecked-fix",
					title: "Fix defaultChecked sync",
					sourceRepo: "facebook/react",
					sourceCommitUrl: "https://github.com/facebook/react/commit/abc",
					diff: "diff",
					results: [
						{
							modelId: BENCHMARK_MODELS[0].id,
							tier: "small",
							status: "success",
							message: "fix(web): sync defaultChecked in uncontrolled input",
							latencyMs: 111,
							costUsd: 0.00011,
							inputTokens: 11,
							outputTokens: 6,
							humanReview: {
								overallScore: 5,
								notes: "Best candidate.",
								winnerFlag: true,
							},
							providerMetadata: null,
						},
					],
				},
			],
			aggregate: {
				byModel: [],
				smallTopModelId: null,
				frontierTopModelId: null,
			},
		};

		const lookup = createHumanReviewLookup(existing);
		const key = reviewKey(
			"react-input-defaultchecked-fix",
			BENCHMARK_MODELS[0].id,
		);
		const preserved = resolveHumanReview(lookup.get(key));

		expect(preserved.overallScore).toBe(5);
		expect(preserved.notes).toBe("Best candidate.");
		expect(preserved.winnerFlag).toBe(true);
	});

	it("computes aggregate averages and error counts", () => {
		const modelA = BENCHMARK_MODELS[0];
		const modelB = BENCHMARK_MODELS[3];

		const scenarios: BenchmarkScenario[] = [
			{
				id: "s1",
				title: "S1",
				sourceRepo: "repo",
				sourceCommitUrl: "url",
				diff: "diff1",
				results: [
					{
						modelId: modelA.id,
						tier: modelA.tier,
						status: "success",
						message: "fix(a): one",
						latencyMs: 100,
						costUsd: 0.0001,
						inputTokens: 10,
						outputTokens: 10,
						humanReview: {
							overallScore: 4,
							notes: "ok",
							winnerFlag: false,
						},
						providerMetadata: null,
					},
					{
						modelId: modelB.id,
						tier: modelB.tier,
						status: "error",
						message: "",
						latencyMs: 450,
						costUsd: null,
						inputTokens: 0,
						outputTokens: 0,
						humanReview: {
							overallScore: 2,
							notes: "failed",
							winnerFlag: false,
						},
						providerMetadata: null,
						errorMessage: "network",
					},
				],
			},
			{
				id: "s2",
				title: "S2",
				sourceRepo: "repo",
				sourceCommitUrl: "url",
				diff: "diff2",
				results: [
					{
						modelId: modelA.id,
						tier: modelA.tier,
						status: "success",
						message: "fix(a): two",
						latencyMs: 200,
						costUsd: 0.0002,
						inputTokens: 20,
						outputTokens: 15,
						humanReview: {
							overallScore: 5,
							notes: "great",
							winnerFlag: true,
						},
						providerMetadata: null,
					},
					{
						modelId: modelB.id,
						tier: modelB.tier,
						status: "success",
						message: "refactor(core): clean helper flow",
						latencyMs: 300,
						costUsd: 0.001,
						inputTokens: 30,
						outputTokens: 14,
						humanReview: {
							overallScore: 3,
							notes: "fine",
							winnerFlag: false,
						},
						providerMetadata: null,
					},
				],
			},
		];

		const aggregate = buildAggregate({
			models: [modelA, modelB],
			scenarios,
		});

		const modelAStats = aggregate.byModel.find(
			(entry) => entry.modelId === modelA.id,
		);
		const modelBStats = aggregate.byModel.find(
			(entry) => entry.modelId === modelB.id,
		);

		expect(modelAStats?.avgLatencyMs).toBe(150);
		expect(modelAStats?.avgCostUsd).toBe(0.00015);
		expect(modelAStats?.errorCount).toBe(0);
		expect(modelAStats?.avgScore).toBe(4.5);

		expect(modelBStats?.successCount).toBe(1);
		expect(modelBStats?.errorCount).toBe(1);
		expect(modelBStats?.avgLatencyMs).toBe(300);
		expect(modelBStats?.avgCostUsd).toBe(0.001);
	});

	it("creates model-level error results with status=error", () => {
		const result = toErrorResult({
			model: BENCHMARK_MODELS[1],
			humanReview: {
				overallScore: 3,
				notes: "Pending manual review.",
				winnerFlag: false,
			},
			latencyMs: 88,
			error: new Error("simulated failure"),
		});

		expect(result.status).toBe("error");
		expect(result.modelId).toBe(BENCHMARK_MODELS[1].id);
		expect(result.errorMessage).toContain("simulated failure");
		expect(result.message).toBe("");
	});

	it("creates a lookup for existing scenario/model results", () => {
		const existing: BenchmarkDataset = {
			generatedAt: new Date().toISOString(),
			provider: "vercel-ai-gateway",
			models: [BENCHMARK_MODELS[0]],
			scenarios: [
				{
					id: "react-input-defaultchecked-fix",
					title: "Fix defaultChecked sync",
					sourceRepo: "facebook/react",
					sourceCommitUrl: "https://github.com/facebook/react/commit/abc",
					diff: "diff-v1",
					results: [
						{
							modelId: BENCHMARK_MODELS[0].id,
							tier: BENCHMARK_MODELS[0].tier,
							status: "success",
							message: "fix(web): sync defaultChecked in uncontrolled input",
							latencyMs: 111,
							costUsd: 0.00011,
							inputTokens: 11,
							outputTokens: 6,
							humanReview: {
								overallScore: 5,
								notes: "Best candidate.",
								winnerFlag: true,
							},
							providerMetadata: null,
						},
					],
				},
			],
			aggregate: {
				byModel: [],
				smallTopModelId: null,
				frontierTopModelId: null,
			},
		};

		const lookup = createExistingScenarioLookup(existing);
		const entry = lookup.get("react-input-defaultchecked-fix");
		const result = entry?.resultByModelId.get(BENCHMARK_MODELS[0].id);

		expect(entry?.diff).toBe("diff-v1");
		expect(result?.message).toContain("sync defaultChecked");
		expect(result?.humanReview.overallScore).toBe(5);
	});

	it("reuses an existing result and aligns it with current model metadata", () => {
		const reused = toReusedResult({
			existingResult: {
				modelId: BENCHMARK_MODELS[0].id,
				tier: "small",
				status: "success",
				message: "fix(core): stabilize parse flow",
				latencyMs: 123,
				costUsd: 0.000123,
				inputTokens: 10,
				outputTokens: 7,
				humanReview: {
					overallScore: 2,
					notes: "old review",
					winnerFlag: false,
				},
				providerMetadata: undefined,
			},
			model: BENCHMARK_MODELS[3],
			preservedReview: {
				overallScore: 5,
				notes: "new review",
				winnerFlag: true,
			},
		});

		expect(reused.modelId).toBe(BENCHMARK_MODELS[3].id);
		expect(reused.tier).toBe(BENCHMARK_MODELS[3].tier);
		expect(reused.message).toBe("fix(core): stabilize parse flow");
		expect(reused.humanReview.overallScore).toBe(5);
		expect(reused.humanReview.notes).toBe("new review");
		expect(reused.providerMetadata).toBeNull();
	});

	it("reuses only successful existing results", () => {
		const success = shouldReuseExistingResult({
			modelId: BENCHMARK_MODELS[0].id,
			tier: BENCHMARK_MODELS[0].tier,
			status: "success",
			message: "fix(api): handle null body",
			latencyMs: 1,
			costUsd: 0.000001,
			inputTokens: 1,
			outputTokens: 1,
			humanReview: {
				overallScore: 3,
				notes: "Pending manual review.",
				winnerFlag: false,
			},
			providerMetadata: null,
		});
		const failure = shouldReuseExistingResult({
			modelId: BENCHMARK_MODELS[0].id,
			tier: BENCHMARK_MODELS[0].tier,
			status: "error",
			message: "",
			latencyMs: 1,
			costUsd: null,
			inputTokens: 0,
			outputTokens: 0,
			humanReview: {
				overallScore: 3,
				notes: "Pending manual review.",
				winnerFlag: false,
			},
			providerMetadata: null,
			errorMessage: "unauthenticated",
		});

		expect(success).toBe(true);
		expect(failure).toBe(false);
	});

	it("parses --set option for fixture selection", () => {
		const parsed = parseGenerateCliArgs(["--set", "react"]);
		expect(parsed).toEqual({
			fixtureSelection: {
				kind: "set",
				setName: "react",
			},
		});
	});

	it("uses default fixture set when no option is provided", () => {
		const parsed = parseGenerateCliArgs([]);
		expect(parsed).toEqual({
			fixtureSelection: {
				kind: "set",
				setName: "react",
			},
		});
	});

	it("parses --repo option for fixture selection", () => {
		const parsed = parseGenerateCliArgs(["--repo", "Vercel/Next.js"]);
		expect(parsed).toEqual({
			fixtureSelection: {
				kind: "githubRepo",
				owner: "vercel",
				repo: "next.js",
			},
		});
	});

	it("rejects conflicting --set and --repo options", () => {
		expect(() =>
			parseGenerateCliArgs(["--set", "react", "--repo", "vercel/next.js"]),
		).toThrow("Use one of --set, --repo, or --github-all");
	});

	it("parses --github-all option for fixture selection", () => {
		const parsed = parseGenerateCliArgs(["--github-all"]);
		expect(parsed).toEqual({
			fixtureSelection: {
				kind: "githubAll",
			},
		});
	});

	it("maps --set github to github-all selection", () => {
		const parsed = parseGenerateCliArgs(["--set", "github"]);
		expect(parsed).toEqual({
			fixtureSelection: {
				kind: "githubAll",
			},
		});
	});

	it("rejects conflicting --repo and --github-all options", () => {
		expect(() =>
			parseGenerateCliArgs(["--repo", "vercel/next.js", "--github-all"]),
		).toThrow("Use one of --set, --repo, or --github-all");
	});

	it("parses github repo input with owner/repo format", () => {
		const namespace = parseGitHubRepoInput("faceBook/react");
		expect(namespace).toEqual({
			owner: "facebook",
			repo: "react",
		});
	});

	it("parses --model option for a single model rerun", () => {
		const parsed = parseGenerateCliArgs([
			"--set",
			"github",
			"--model",
			"xai/grok-code-fast-1",
		]);
		expect(parsed).toEqual({
			fixtureSelection: {
				kind: "githubAll",
			},
			modelIds: ["xai/grok-code-fast-1"],
		});
	});

	it("rejects unknown model IDs", () => {
		expect(() =>
			parseGenerateCliArgs(["--model", "invalid-model-id"]),
		).toThrow("Unknown model: invalid-model-id.");

		expect(() =>
			parseGenerateCliArgs(["--model", ""]),
		).toThrow("Missing value for --model.");
	});

	it("rejects invalid github repo input format", () => {
		expect(() => parseGitHubRepoInput("vercel-nextjs")).toThrow(
			"Invalid --repo value",
		);
	});
});
