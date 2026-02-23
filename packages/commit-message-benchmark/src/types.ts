export type BenchmarkTier = "small" | "frontier";

export type BenchmarkStatus = "success" | "error";

export type HumanReviewScore = 1 | 2 | 3 | 4 | 5;

export interface HumanReview {
	overallScore: HumanReviewScore;
	notes: string;
	winnerFlag: boolean;
}

export interface BenchmarkModelConfig {
	id: string;
	tier: BenchmarkTier;
	label: string;
}

export interface BenchmarkResult {
	modelId: string;
	tier: BenchmarkTier;
	status: BenchmarkStatus;
	message: string;
	latencyMs: number | null;
	costUsd: number | null;
	inputTokens: number;
	outputTokens: number;
	humanReview: HumanReview;
	providerMetadata: unknown;
	errorMessage?: string;
}

export interface BenchmarkScenario {
	id: string;
	title: string;
	sourceRepo: string;
	sourceCommitUrl: string;
	diff: string;
	results: BenchmarkResult[];
}

export interface BenchmarkAggregateModel {
	modelId: string;
	tier: BenchmarkTier;
	successCount: number;
	errorCount: number;
	avgLatencyMs: number | null;
	avgCostUsd: number | null;
	avgScore: number;
}

export interface BenchmarkAggregate {
	byModel: BenchmarkAggregateModel[];
	smallTopModelId: string | null;
	frontierTopModelId: string | null;
}

export interface BenchmarkDataset {
	generatedAt: string;
	provider: string;
	models: BenchmarkModelConfig[];
	scenarios: BenchmarkScenario[];
	aggregate: BenchmarkAggregate;
}

export interface FixtureScenarioIndexEntry {
	id: string;
	title: string;
	sourceRepo: string;
	sourceCommitUrl: string;
	diffFile: string;
	metadataFile?: string;
}

export interface GitHubCommitMetadataFile {
	filename: string;
	status: string;
	additions: number;
	deletions: number;
	changes: number;
	patch?: string;
}

export interface GitHubCommitMetadata {
	schemaVersion: 1;
	source: "github";
	owner: string;
	repo: string;
	sha: string;
	htmlUrl: string;
	apiUrl: string;
	diffUrl: string;
	message: string;
	authorName: string | null;
	authorEmail: string | null;
	authoredAt: string | null;
	committerName: string | null;
	committerEmail: string | null;
	committedAt: string | null;
	parents: string[];
	stats: {
		additions: number;
		deletions: number;
		total: number;
	};
	files: GitHubCommitMetadataFile[];
	fetchedAt: string;
}

export interface FixtureScenario {
	id: string;
	title: string;
	sourceRepo: string;
	sourceCommitUrl: string;
	diff: string;
}
