import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateText } from "ai";
import {
	assertDatasetShape,
	buildAggregate,
	createHumanReviewLookup,
	normalizeCommitMessage,
	resolveHumanReview,
	reviewKey,
	sanitizeCommitMessageWrappers,
	withSortedResults,
} from "./dataset";
import {
	DEFAULT_FIXTURE_SET,
	loadAllGitHubFixtureScenarios,
	loadFixtureScenarios,
	loadGitHubRepoFixtureScenarios,
	normalizeGitHubFixtureNamespace,
} from "./fixtures";
import { BENCHMARK_MODELS, BENCHMARK_PROVIDER } from "./models";
import { COMMIT_MESSAGE_SYSTEM_PROMPT } from "./prompt";
import type {
	BenchmarkDataset,
	BenchmarkModelConfig,
	BenchmarkResult,
	FixtureScenario,
	HumanReview,
} from "./types";

const OUTPUT_DATASET_PATH = new URL(
	"../../web/lib/demo/commit-message-benchmark.dataset.json",
	import.meta.url,
);
const DEFAULT_MAX_CONCURRENCY = 3;

export type FixtureSelection =
	| {
			kind: "set";
			setName: string;
	  }
	| {
			kind: "githubAll";
	  }
	| {
			kind: "githubRepo";
			owner: string;
			repo: string;
	  };

function toErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return String(error);
}

function toNumberOrNull(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	return null;
}

function extractGatewayCost(providerMetadata: unknown): number | null {
	if (providerMetadata == null || typeof providerMetadata !== "object") {
		return null;
	}
	const gateway = (providerMetadata as Record<string, unknown>).gateway;
	if (gateway == null || typeof gateway !== "object") {
		return null;
	}

	const gatewayRecord = gateway as Record<string, unknown>;
	const rawCost = gatewayRecord.marketCost ?? gatewayRecord.cost;
	if (typeof rawCost === "number" && Number.isFinite(rawCost)) {
		return rawCost;
	}
	if (typeof rawCost === "string") {
		const parsed = Number.parseFloat(rawCost);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

function parseMaxConcurrency(raw: string | undefined): number {
	if (!raw) {
		return DEFAULT_MAX_CONCURRENCY;
	}
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_MAX_CONCURRENCY;
	}
	return parsed;
}

function formatFixtureSelection(selection: FixtureSelection): string {
	if (selection.kind === "githubAll") {
		return "github/*/*";
	}
	if (selection.kind === "githubRepo") {
		return `github/${selection.owner}/${selection.repo}`;
	}
	return selection.setName;
}

export function parseGitHubRepoInput(value: string): {
	owner: string;
	repo: string;
} {
	const trimmed = value.trim();
	const match = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
	if (!match) {
		throw new Error(
			`Invalid --repo value: ${value}. Expected format: <owner>/<repo>.`,
		);
	}

	return normalizeGitHubFixtureNamespace({
		owner: match[1],
		repo: match[2],
	});
}

function readRequiredOptionValue(args: {
	argv: string[];
	index: number;
	optionName: string;
}): string {
	const value = args.argv[args.index + 1];
	if (!value || value.startsWith("--")) {
		throw new Error(`Missing value for ${args.optionName}.`);
	}
	return value;
}

function printHelpAndExit(code: number): never {
	const usage = [
		"Usage:",
		"  bun run --cwd packages/commit-message-benchmark generate [--set <name> | --repo <owner>/<repo> | --github-all]",
		"",
		"Options:",
		`  --set <name>           fixture set under fixtures/<name> (default: ${DEFAULT_FIXTURE_SET})`,
		"  --repo <owner>/<repo> fixture set under fixtures/github/<owner>/<repo>",
		"  --github-all           fixture sets under fixtures/github/<owner>/<repo>/*",
		"  --github-repo <o/r>   alias of --repo",
	];
	const printer = code === 0 ? console.log : console.error;
	printer(usage.join("\n"));
	process.exit(code);
}

export function parseGenerateCliArgs(argv: string[]): FixtureSelection {
	let setName: string | undefined;
	let githubRepo: string | undefined;
	let githubAll = false;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--set") {
			setName = readRequiredOptionValue({
				argv,
				index,
				optionName: "--set",
			});
			index += 1;
			continue;
		}
		if (arg === "--repo" || arg === "--github-repo") {
			githubRepo = readRequiredOptionValue({
				argv,
				index,
				optionName: arg,
			});
			index += 1;
			continue;
		}
		if (arg === "--github-all") {
			githubAll = true;
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			printHelpAndExit(0);
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (
		(setName && githubRepo) ||
		(setName && githubAll) ||
		(githubRepo && githubAll)
	) {
		throw new Error("Use one of --set, --repo, or --github-all.");
	}

	if (githubRepo) {
		const namespace = parseGitHubRepoInput(githubRepo);
		return {
			kind: "githubRepo",
			owner: namespace.owner,
			repo: namespace.repo,
		};
	}

	if (githubAll) {
		return { kind: "githubAll" };
	}

	if (setName?.trim() === "github") {
		return { kind: "githubAll" };
	}

	return {
		kind: "set",
		setName: (setName ?? DEFAULT_FIXTURE_SET).trim(),
	};
}

async function loadScenariosBySelection(
	selection: FixtureSelection,
): Promise<FixtureScenario[]> {
	if (selection.kind === "githubAll") {
		return loadAllGitHubFixtureScenarios();
	}
	if (selection.kind === "githubRepo") {
		return loadGitHubRepoFixtureScenarios({
			owner: selection.owner,
			repo: selection.repo,
		});
	}
	return loadFixtureScenarios(selection.setName);
}

async function fileExists(path: URL): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function loadExistingDataset(): Promise<BenchmarkDataset | null> {
	if (!(await fileExists(OUTPUT_DATASET_PATH))) {
		return null;
	}

	try {
		const text = await readFile(OUTPUT_DATASET_PATH, "utf8");
		return JSON.parse(text) as BenchmarkDataset;
	} catch (error) {
		console.warn(
			"[benchmark] Failed to parse existing dataset, continuing without review preservation:",
			toErrorMessage(error),
		);
		return null;
	}
}

async function mapWithConcurrency<T, R>(args: {
	items: T[];
	concurrency: number;
	mapper: (item: T, index: number) => Promise<R>;
}): Promise<R[]> {
	const { items, mapper } = args;
	const concurrency = Math.max(1, Math.min(args.concurrency, items.length));
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	const workers = Array.from({ length: concurrency }, async () => {
		while (true) {
			const currentIndex = nextIndex;
			nextIndex += 1;
			if (currentIndex >= items.length) {
				return;
			}
			results[currentIndex] = await mapper(items[currentIndex], currentIndex);
		}
	});

	await Promise.all(workers);
	return results;
}

export function toErrorResult(args: {
	model: BenchmarkModelConfig;
	humanReview: HumanReview;
	latencyMs: number;
	error: unknown;
	providerMetadata?: unknown;
}): BenchmarkResult {
	return {
		modelId: args.model.id,
		tier: args.model.tier,
		status: "error",
		message: "",
		latencyMs: args.latencyMs,
		costUsd: null,
		inputTokens: 0,
		outputTokens: 0,
		humanReview: resolveHumanReview(args.humanReview),
		providerMetadata: args.providerMetadata ?? null,
		errorMessage: toErrorMessage(args.error),
	};
}

async function generateResult(args: {
	diff: string;
	model: BenchmarkModelConfig;
	humanReview: HumanReview;
}): Promise<BenchmarkResult> {
	const startedAt = Date.now();

	try {
		const response = await generateText({
			model: args.model.id,
			system: COMMIT_MESSAGE_SYSTEM_PROMPT,
			prompt: args.diff,
			maxOutputTokens: 120,
			temperature: 0,
		});

		const message = sanitizeCommitMessageWrappers(
			normalizeCommitMessage(response.text),
		);
		if (!message) {
			throw new Error("Generated commit message was empty.");
		}

		const providerMetadata = response.providerMetadata ?? null;
		const inputTokens = toNumberOrNull(response.usage.inputTokens) ?? 0;
		const outputTokens = toNumberOrNull(response.usage.outputTokens) ?? 0;

		return {
			modelId: args.model.id,
			tier: args.model.tier,
			status: "success",
			message,
			latencyMs: Date.now() - startedAt,
			costUsd: extractGatewayCost(providerMetadata),
			inputTokens,
			outputTokens,
			humanReview: resolveHumanReview(args.humanReview),
			providerMetadata,
		};
	} catch (error) {
		return toErrorResult({
			model: args.model,
			humanReview: args.humanReview,
			latencyMs: Date.now() - startedAt,
			error,
		});
	}
}

async function run(args?: {
	fixtureSelection?: FixtureSelection;
}): Promise<BenchmarkDataset> {
	console.log("[benchmark] Started");

	if (!process.env.AI_GATEWAY_API_KEY) {
		console.warn(
			"[benchmark] AI_GATEWAY_API_KEY is not set. Results will likely be recorded as errors.",
		);
	}

	const fixtureSelection = args?.fixtureSelection ?? {
		kind: "set",
		setName: DEFAULT_FIXTURE_SET,
	};
	console.log(
		`[benchmark] Loading fixtures: selection=${formatFixtureSelection(fixtureSelection)}`,
	);

	const maxConcurrency = parseMaxConcurrency(process.env.BENCH_MAX_CONCURRENCY);
	const [fixtureScenarios, existingDataset] = await Promise.all([
		loadScenariosBySelection(fixtureSelection),
		loadExistingDataset(),
	]);
	if (fixtureScenarios.length === 0) {
		throw new Error(
			`No fixture scenarios found for '${formatFixtureSelection(fixtureSelection)}'.`,
		);
	}
	console.log(`[benchmark] Fixture count: ${fixtureScenarios.length}`);

	const reviewLookup = createHumanReviewLookup(existingDataset);

	const scenarios = [];
	for (const [fixtureIndex, fixtureScenario] of fixtureScenarios.entries()) {
		console.log(
			`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} started: ${fixtureScenario.id}`,
		);
		const results = await mapWithConcurrency({
			items: BENCHMARK_MODELS,
			concurrency: maxConcurrency,
			mapper: async (model, modelIndex) => {
				console.log(
					`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} model ${modelIndex + 1}/${BENCHMARK_MODELS.length} started: ${model.id}`,
				);
				const preservedReview = reviewLookup.get(
					reviewKey(fixtureScenario.id, model.id),
				);
				const humanReview = resolveHumanReview(preservedReview);
				const result = await generateResult({
					diff: fixtureScenario.diff,
					model,
					humanReview,
				});
				if (result.status === "success") {
					console.log(
						`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} model ${modelIndex + 1}/${BENCHMARK_MODELS.length} finished: ${model.id} (status=success, latencyMs=${result.latencyMs ?? "n/a"}, costUsd=${result.costUsd ?? "n/a"})`,
					);
				} else {
					console.log(
						`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} model ${modelIndex + 1}/${BENCHMARK_MODELS.length} finished: ${model.id} (status=error, message=${result.errorMessage ?? "unknown error"})`,
					);
				}
				return result;
			},
		});
		const successCount = results.filter(
			(result) => result.status === "success",
		).length;
		const errorCount = results.length - successCount;
		console.log(
			`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} finished: ${fixtureScenario.id} (success=${successCount}, error=${errorCount})`,
		);

		scenarios.push({
			id: fixtureScenario.id,
			title: fixtureScenario.title,
			sourceRepo: fixtureScenario.sourceRepo,
			sourceCommitUrl: fixtureScenario.sourceCommitUrl,
			diff: fixtureScenario.diff,
			results: withSortedResults(results),
		});
	}

	const dataset: BenchmarkDataset = {
		generatedAt: new Date().toISOString(),
		provider: BENCHMARK_PROVIDER,
		models: BENCHMARK_MODELS,
		scenarios,
		aggregate: buildAggregate({
			models: BENCHMARK_MODELS,
			scenarios,
		}),
	};

	assertDatasetShape(dataset);
	return dataset;
}

async function writeDataset(dataset: BenchmarkDataset): Promise<void> {
	const outputPath = fileURLToPath(OUTPUT_DATASET_PATH);
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
}

function logSummary(
	dataset: BenchmarkDataset,
	fixtureSelection: FixtureSelection,
): void {
	console.log("[benchmark] Generated commit message benchmark dataset");
	console.log(`  provider: ${dataset.provider}`);
	console.log(`  fixtures: ${formatFixtureSelection(fixtureSelection)}`);
	console.log(`  models: ${dataset.models.length}`);
	console.log(`  scenarios: ${dataset.scenarios.length}`);
	for (const entry of dataset.aggregate.byModel) {
		console.log(
			`  - ${entry.modelId}: success=${entry.successCount}, error=${entry.errorCount}, avgLatencyMs=${entry.avgLatencyMs ?? "n/a"}, avgCostUsd=${entry.avgCostUsd ?? "n/a"}, avgScore=${entry.avgScore}`,
		);
	}
	console.log(`  output: ${fileURLToPath(OUTPUT_DATASET_PATH)}`);
}

export async function generateBenchmarkDataset(args?: {
	fixtureSelection?: FixtureSelection;
}): Promise<BenchmarkDataset> {
	const fixtureSelection = args?.fixtureSelection ?? {
		kind: "set",
		setName: DEFAULT_FIXTURE_SET,
	};
	const dataset = await run({ fixtureSelection });
	await writeDataset(dataset);
	logSummary(dataset, fixtureSelection);
	console.log("[benchmark] All done");
	return dataset;
}

if (import.meta.main) {
	let fixtureSelection: FixtureSelection;
	try {
		fixtureSelection = parseGenerateCliArgs(process.argv.slice(2));
	} catch (error) {
		console.error("[benchmark] Failed:", toErrorMessage(error));
		process.exit(1);
	}

	generateBenchmarkDataset({ fixtureSelection }).catch((error) => {
		console.error("[benchmark] Failed:", toErrorMessage(error));
		process.exit(1);
	});
}
