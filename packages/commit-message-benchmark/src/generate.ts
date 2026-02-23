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
const BENCHMARK_MODEL_IDS = new Set(BENCHMARK_MODELS.map((model) => model.id));

export type BenchmarkGenerateArgs = {
	fixtureSelection: FixtureSelection;
	modelIds?: string[];
};
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
		`  --model <id>           regenerate only this model (comma-separated IDs supported)`,
	];
	const printer = code === 0 ? console.log : console.error;
	printer(usage.join("\n"));
	process.exit(code);
}

export function parseGenerateCliArgs(argv: string[]): BenchmarkGenerateArgs {
	let setName: string | undefined;
	let githubRepo: string | undefined;
	let githubAll = false;
	let modelIds: string[] = [];

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
		if (arg === "--model") {
			const modelValue = readRequiredOptionValue({
				argv,
				index,
				optionName: "--model",
			});
			index += 1;
			const values = modelValue
				.split(",")
				.map((value) => value.trim())
				.filter(Boolean);
			if (values.length === 0) {
				throw new Error("Missing value for --model.");
			}
			for (const modelId of values) {
				if (!BENCHMARK_MODEL_IDS.has(modelId)) {
					throw new Error(`Unknown model: ${modelId}.`);
				}
			}
			modelIds = modelIds.concat(values);
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

	const normalizedModelIds =
		modelIds.length > 0 ? [...new Set(modelIds)] : undefined;
	const fixtureSelection =
		setName?.trim() === "github"
			? { kind: "githubAll" }
			: setName
				? { kind: "set", setName: setName.trim() }
				: {
						kind: "set",
						setName: DEFAULT_FIXTURE_SET,
					};

	if (githubRepo) {
		const namespace = parseGitHubRepoInput(githubRepo);
		return {
			fixtureSelection: { kind: "githubRepo", ...namespace },
			...(normalizedModelIds ? { modelIds: normalizedModelIds } : {}),
		};
	}

	if (githubAll) {
		return {
			fixtureSelection: { kind: "githubAll" },
			...(normalizedModelIds ? { modelIds: normalizedModelIds } : {}),
		};
	}

	return {
		fixtureSelection,
		...(normalizedModelIds ? { modelIds: normalizedModelIds } : {}),
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
			"[benchmark] Failed to parse existing dataset, continuing without result/review preservation:",
			toErrorMessage(error),
		);
		return null;
	}
}

export interface ExistingScenarioLookupEntry {
	diff: string;
	resultByModelId: Map<string, BenchmarkResult>;
}

export function createExistingScenarioLookup(
	existing: BenchmarkDataset | null,
): Map<string, ExistingScenarioLookupEntry> {
	const lookup = new Map<string, ExistingScenarioLookupEntry>();
	if (!existing) {
		return lookup;
	}

	for (const scenario of existing.scenarios) {
		const resultByModelId = new Map<string, BenchmarkResult>();
		for (const result of scenario.results) {
			resultByModelId.set(result.modelId, {
				...result,
				humanReview: resolveHumanReview(result.humanReview),
				providerMetadata: result.providerMetadata ?? null,
			});
		}
		lookup.set(scenario.id, {
			diff: scenario.diff,
			resultByModelId,
		});
	}

	return lookup;
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

export function toReusedResult(args: {
	existingResult: BenchmarkResult;
	model: BenchmarkModelConfig;
	preservedReview?: HumanReview;
}): BenchmarkResult {
	return {
		...args.existingResult,
		modelId: args.model.id,
		tier: args.model.tier,
		humanReview: resolveHumanReview(
			args.preservedReview ?? args.existingResult.humanReview,
		),
		providerMetadata: args.existingResult.providerMetadata ?? null,
	};
}

export function shouldReuseExistingResult(result: BenchmarkResult): boolean {
	return result.status === "success";
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
	modelIds?: string[];
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
	const requestedModelIds = args?.modelIds ? [...new Set(args.modelIds)] : [];
	const requestedModelSet = new Set(requestedModelIds);
	const shouldFilterModels = requestedModelIds.length > 0;
	if (shouldFilterModels) {
		const invalidModelIds = requestedModelIds.filter(
			(modelId) => !BENCHMARK_MODEL_IDS.has(modelId),
		);
		if (invalidModelIds.length > 0) {
			throw new Error(`Unknown model: ${invalidModelIds.join(", ")}.`);
		}
	}

	console.log(
		`[benchmark] Loading fixtures: selection=${formatFixtureSelection(fixtureSelection)}`,
	);

	const maxConcurrency = parseMaxConcurrency(process.env.BENCH_MAX_CONCURRENCY);
	const [fixtureScenarios, existingDataset] = await Promise.all([
		loadScenariosBySelection(fixtureSelection),
		loadExistingDataset(),
	]);
	if (shouldFilterModels && existingDataset == null) {
		throw new Error(
			"Model filtering requires an existing dataset at web/lib/demo/commit-message-benchmark.dataset.json.",
		);
	}
	if (fixtureScenarios.length === 0) {
		throw new Error(
			`No fixture scenarios found for '${formatFixtureSelection(fixtureSelection)}'.`,
		);
	}
	console.log(`[benchmark] Fixture count: ${fixtureScenarios.length}`);

	const reviewLookup = createHumanReviewLookup(existingDataset);
	const existingScenarioLookup = createExistingScenarioLookup(existingDataset);

	const scenarios = [];
	for (const [fixtureIndex, fixtureScenario] of fixtureScenarios.entries()) {
		console.log(
			`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} started: ${fixtureScenario.id}`,
		);
		const existingScenario = existingScenarioLookup.get(fixtureScenario.id);
		if (existingScenario && existingScenario.diff !== fixtureScenario.diff) {
			console.log(
				`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} existing results ignored: diff changed`,
			);
		}
		const results = await mapWithConcurrency({
			items: BENCHMARK_MODELS,
			concurrency: maxConcurrency,
			mapper: async (model, modelIndex) => {
				const shouldRegenerate =
					!shouldFilterModels || requestedModelSet.has(model.id);
				console.log(
					`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} model ${modelIndex + 1}/${BENCHMARK_MODELS.length} started: ${model.id}`,
				);
				const lookupKey = reviewKey(fixtureScenario.id, model.id);
				const preservedReview = reviewLookup.get(lookupKey);
				let existingResult: BenchmarkResult | undefined;
				if (
					existingScenario &&
					existingScenario.diff === fixtureScenario.diff
				) {
					existingResult = existingScenario.resultByModelId.get(model.id);
				}
				if (existingResult && !shouldRegenerate) {
					const reusedResult = toReusedResult({
						existingResult,
						model,
						preservedReview,
					});
					console.log(
						`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} model ${modelIndex + 1}/${BENCHMARK_MODELS.length} skipped: ${model.id} (status=${reusedResult.status}, source=existing-dataset)`,
					);
					return reusedResult;
				}
				if (existingResult && shouldRegenerate) {
					console.log(
						`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} model ${modelIndex + 1}/${BENCHMARK_MODELS.length} regenerating: ${model.id} (existing-status=${existingResult.status})`,
					);
				} else if (!shouldRegenerate) {
					console.log(
						`[benchmark] Fixture ${fixtureIndex + 1}/${fixtureScenarios.length} model ${modelIndex + 1}/${BENCHMARK_MODELS.length} generating: ${model.id} (no existing result)`,
					);
				}
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
	modelIds?: string[];
}): Promise<BenchmarkDataset> {
	const fixtureSelection = args?.fixtureSelection ?? {
		kind: "set",
		setName: DEFAULT_FIXTURE_SET,
	};
	const dataset = await run({ fixtureSelection, modelIds: args?.modelIds });
	await writeDataset(dataset);
	logSummary(dataset, fixtureSelection);
	console.log("[benchmark] All done");
	return dataset;
}

if (import.meta.main) {
	let fixtureSelection: FixtureSelection;
	let modelIds: string[] | undefined;
	try {
		const args = parseGenerateCliArgs(process.argv.slice(2));
		fixtureSelection = args.fixtureSelection;
		modelIds = args.modelIds;
	} catch (error) {
		console.error("[benchmark] Failed:", toErrorMessage(error));
		process.exit(1);
	}

	generateBenchmarkDataset({ fixtureSelection, modelIds }).catch((error) => {
		console.error("[benchmark] Failed:", toErrorMessage(error));
		process.exit(1);
	});
}
