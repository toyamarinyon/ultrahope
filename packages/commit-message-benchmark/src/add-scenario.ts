import { mkdir, writeFile } from "node:fs/promises";
import {
	getGitHubRepoFixtureFilePath,
	loadGitHubRepoFixtureIndex,
	saveGitHubRepoFixtureIndex,
	writeJsonFile,
} from "./fixtures";
import type { FixtureScenarioIndexEntry, GitHubCommitMetadata } from "./types";

const GITHUB_COMMIT_URL_REGEX =
	/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})(?:[/?#].*)?$/i;
const COMMIT_SHA_REGEX = /^[0-9a-f]{7,40}$/i;

const USER_AGENT = "ultrahope-commit-message-benchmark/1.0";

type ParsedArgs = {
	url: string;
	id?: string;
	title?: string;
	overwrite: boolean;
	dryRun: boolean;
};

type ParsedCommitRef = {
	owner: string;
	repo: string;
	sha: string;
	htmlUrl: string;
	apiUrl: string;
	diffUrl: string;
};

type CommitArtifactFiles = {
	commitDir: string;
	diffFile: string;
	metadataFile: string;
};

type GitHubCommitApiResponse = {
	sha: string;
	html_url: string;
	commit: {
		message: string;
		author: {
			name: string;
			email: string;
			date: string;
		} | null;
		committer: {
			name: string;
			email: string;
			date: string;
		} | null;
	};
	parents: Array<{ sha: string }>;
	stats?: {
		total: number;
		additions: number;
		deletions: number;
	};
	files?: Array<{
		filename: string;
		status: string;
		additions: number;
		deletions: number;
		changes: number;
		patch?: string;
	}>;
};

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-")
		.slice(0, 48);
}

export function parseGitHubCommitUrl(rawUrl: string): ParsedCommitRef {
	const normalized = rawUrl.trim();
	const match = normalized.match(GITHUB_COMMIT_URL_REGEX);
	if (!match) {
		throw new Error(
			`Invalid GitHub commit URL: ${rawUrl}. Expected https://github.com/<owner>/<repo>/commit/<sha>.`,
		);
	}

	const [, owner, repo, sha] = match;
	const safeOwner = owner.toLowerCase();
	const safeRepo = repo.toLowerCase();
	const safeSha = sha.toLowerCase();

	return {
		owner: safeOwner,
		repo: safeRepo,
		sha: safeSha,
		htmlUrl: `https://github.com/${safeOwner}/${safeRepo}/commit/${safeSha}`,
		apiUrl: `https://api.github.com/repos/${safeOwner}/${safeRepo}/commits/${safeSha}`,
		diffUrl: `https://github.com/${safeOwner}/${safeRepo}/commit/${safeSha}.diff`,
	};
}

export function createScenarioId(args: {
	repo: string;
	sha: string;
	message: string;
}): string {
	const shaShort = args.sha.slice(0, 8).toLowerCase();
	const messageSlug = slugify(args.message.split("\n")[0] ?? "commit");
	const repoSlug = slugify(args.repo);
	const base = [repoSlug, shaShort, messageSlug].filter(Boolean).join("-");
	return base || `${repoSlug || "commit"}-${shaShort}`;
}

export function resolveUniqueId(args: {
	baseId: string;
	existingIds: Set<string>;
	allowExisting: boolean;
}): string {
	if (args.allowExisting || !args.existingIds.has(args.baseId)) {
		return args.baseId;
	}

	let suffix = 2;
	while (args.existingIds.has(`${args.baseId}-${suffix}`)) {
		suffix += 1;
	}

	return `${args.baseId}-${suffix}`;
}

export function buildCommitArtifactFiles(
	commitSha: string,
): CommitArtifactFiles {
	const normalizedSha = commitSha.trim().toLowerCase();
	if (!COMMIT_SHA_REGEX.test(normalizedSha)) {
		throw new Error(`Invalid commit sha for fixture path: ${commitSha}`);
	}

	return {
		commitDir: normalizedSha,
		diffFile: `${normalizedSha}/diff.diff`,
		metadataFile: `${normalizedSha}/metadata.json`,
	};
}

function parseArgs(argv: string[]): ParsedArgs {
	let url: string | undefined;
	let id: string | undefined;
	let title: string | undefined;
	let overwrite = false;
	let dryRun = false;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--url") {
			url = argv[index + 1];
			index += 1;
			continue;
		}
		if (arg === "--id") {
			id = argv[index + 1];
			index += 1;
			continue;
		}
		if (arg === "--title") {
			title = argv[index + 1];
			index += 1;
			continue;
		}
		if (arg === "--overwrite") {
			overwrite = true;
			continue;
		}
		if (arg === "--dry-run") {
			dryRun = true;
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			printHelpAndExit(0);
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (!url) {
		printHelpAndExit(1);
	}

	return {
		url,
		id,
		title,
		overwrite,
		dryRun,
	};
}

function printHelpAndExit(code: number): never {
	const usage = [
		"Usage:",
		"  bun run --cwd packages/commit-message-benchmark add --url <github-commit-url> [--id custom-id] [--title custom-title] [--overwrite] [--dry-run]",
		"",
		"Examples:",
		"  bun run --cwd packages/commit-message-benchmark add --url https://github.com/facebook/react/commit/abcdef1234567890",
		'  bun run --cwd packages/commit-message-benchmark add --url https://github.com/facebook/react/commit/abcdef1234567890 --id react-sample --title "React sample diff"',
	];
	const printer = code === 0 ? console.log : console.error;
	printer(usage.join("\n"));
	process.exit(code);
}

function toErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return String(error);
}

function jsonHeaders(): HeadersInit {
	const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
	return {
		Accept: "application/vnd.github+json",
		"User-Agent": USER_AGENT,
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
}

async function fetchText(url: string, headers?: HeadersInit): Promise<string> {
	const response = await fetch(url, { headers });
	const body = await response.text();
	if (!response.ok) {
		throw new Error(
			`Request failed (${response.status}) for ${url}: ${body.slice(0, 200)}`,
		);
	}
	return body;
}

async function fetchJson<T>(url: string, headers?: HeadersInit): Promise<T> {
	const response = await fetch(url, { headers });
	const body = await response.text();
	if (!response.ok) {
		throw new Error(
			`Request failed (${response.status}) for ${url}: ${body.slice(0, 200)}`,
		);
	}
	return JSON.parse(body) as T;
}

async function fetchCommitAssets(commitRef: ParsedCommitRef): Promise<{
	metadata: GitHubCommitMetadata;
	diff: string;
}> {
	const [apiPayload, diff] = await Promise.all([
		fetchJson<GitHubCommitApiResponse>(commitRef.apiUrl, jsonHeaders()),
		fetchText(commitRef.diffUrl, {
			Accept: "text/plain",
			"User-Agent": USER_AGENT,
		}),
	]);

	if (!diff.trim()) {
		throw new Error(`Fetched diff is empty for ${commitRef.htmlUrl}`);
	}

	const metadata: GitHubCommitMetadata = {
		schemaVersion: 1,
		source: "github",
		owner: commitRef.owner,
		repo: commitRef.repo,
		sha: apiPayload.sha,
		htmlUrl: apiPayload.html_url,
		apiUrl: commitRef.apiUrl,
		diffUrl: commitRef.diffUrl,
		message: apiPayload.commit.message,
		authorName: apiPayload.commit.author?.name ?? null,
		authorEmail: apiPayload.commit.author?.email ?? null,
		authoredAt: apiPayload.commit.author?.date ?? null,
		committerName: apiPayload.commit.committer?.name ?? null,
		committerEmail: apiPayload.commit.committer?.email ?? null,
		committedAt: apiPayload.commit.committer?.date ?? null,
		parents: apiPayload.parents.map((parent) => parent.sha),
		stats: {
			additions: apiPayload.stats?.additions ?? 0,
			deletions: apiPayload.stats?.deletions ?? 0,
			total: apiPayload.stats?.total ?? 0,
		},
		files: (apiPayload.files ?? []).map((file) => ({
			filename: file.filename,
			status: file.status,
			additions: file.additions,
			deletions: file.deletions,
			changes: file.changes,
			patch: file.patch,
		})),
		fetchedAt: new Date().toISOString(),
	};

	return { metadata, diff };
}

async function writeScenarioFiles(args: {
	owner: string;
	repo: string;
	diffFile: string;
	metadataFile: string;
	diff: string;
	metadata: GitHubCommitMetadata;
}): Promise<void> {
	const diffPath = getGitHubRepoFixtureFilePath(args.diffFile, {
		owner: args.owner,
		repo: args.repo,
	});
	const metadataPath = getGitHubRepoFixtureFilePath(args.metadataFile, {
		owner: args.owner,
		repo: args.repo,
	});

	await mkdir(new URL(".", diffPath), { recursive: true });
	await mkdir(new URL(".", metadataPath), { recursive: true });
	await writeFile(
		diffPath,
		args.diff.endsWith("\n") ? args.diff : `${args.diff}\n`,
		"utf8",
	);
	await writeJsonFile(metadataPath, args.metadata);
}

function upsertIndexEntry(args: {
	entries: FixtureScenarioIndexEntry[];
	entry: FixtureScenarioIndexEntry;
	overwrite: boolean;
}): FixtureScenarioIndexEntry[] {
	const entries = [...args.entries];
	const existingByIdIndex = entries.findIndex(
		(item) => item.id === args.entry.id,
	);

	if (existingByIdIndex >= 0) {
		if (!args.overwrite) {
			throw new Error(
				`Fixture id '${args.entry.id}' already exists. Use --overwrite or a different --id.`,
			);
		}
		entries[existingByIdIndex] = args.entry;
		return entries;
	}

	entries.push(args.entry);
	return entries;
}

export async function addScenarioFromGitHubCommit(args: ParsedArgs): Promise<{
	entry: FixtureScenarioIndexEntry;
	diffFilePath: string;
	metadataFilePath: string;
	updated: boolean;
}> {
	const commitRef = parseGitHubCommitUrl(args.url);
	const fixtureScope = {
		owner: commitRef.owner,
		repo: commitRef.repo,
	};
	const existingIndex = await loadGitHubRepoFixtureIndex(fixtureScope, {
		allowMissing: true,
	});

	const duplicateCommitEntry = existingIndex.find(
		(entry) => entry.sourceCommitUrl === commitRef.htmlUrl,
	);
	if (duplicateCommitEntry && !args.overwrite && !args.id) {
		throw new Error(
			`Commit already exists as '${duplicateCommitEntry.id}'. Use --overwrite or --id.`,
		);
	}

	const { metadata, diff } = await fetchCommitAssets(commitRef);

	const generatedId = createScenarioId({
		repo: commitRef.repo,
		sha: metadata.sha,
		message: metadata.message,
	});
	const idBase = slugify(args.id ?? duplicateCommitEntry?.id ?? generatedId);
	if (!idBase) {
		throw new Error("Failed to resolve scenario id.");
	}

	const existingIds = new Set(existingIndex.map((entry) => entry.id));
	const resolvedId = resolveUniqueId({
		baseId: idBase,
		existingIds,
		allowExisting: args.overwrite,
	});
	const title = args.title?.trim() || metadata.message.split("\n")[0].trim();
	const artifactFiles = buildCommitArtifactFiles(metadata.sha);

	const entry: FixtureScenarioIndexEntry = {
		id: resolvedId,
		title,
		sourceRepo: `${commitRef.owner}/${commitRef.repo}`,
		sourceCommitUrl: commitRef.htmlUrl,
		diffFile: artifactFiles.diffFile,
		metadataFile: artifactFiles.metadataFile,
	};

	const nextIndex = upsertIndexEntry({
		entries: existingIndex,
		entry,
		overwrite: args.overwrite,
	});

	if (!args.dryRun) {
		await writeScenarioFiles({
			owner: fixtureScope.owner,
			repo: fixtureScope.repo,
			diffFile: artifactFiles.diffFile,
			metadataFile: artifactFiles.metadataFile,
			diff,
			metadata,
		});
		await saveGitHubRepoFixtureIndex({
			owner: fixtureScope.owner,
			repo: fixtureScope.repo,
			entries: nextIndex,
		});
	}

	return {
		entry,
		diffFilePath: getGitHubRepoFixtureFilePath(
			artifactFiles.diffFile,
			fixtureScope,
		).pathname,
		metadataFilePath: getGitHubRepoFixtureFilePath(
			artifactFiles.metadataFile,
			fixtureScope,
		).pathname,
		updated: existingIndex.some((item) => item.id === resolvedId),
	};
}

async function main(): Promise<void> {
	const parsed = parseArgs(process.argv.slice(2));
	const result = await addScenarioFromGitHubCommit(parsed);
	const mode = parsed.dryRun ? "dry-run" : result.updated ? "updated" : "added";
	console.log(
		`[benchmark] ${mode} fixture '${result.entry.id}' in repo '${result.entry.sourceRepo}'`,
	);
	console.log(`  title: ${result.entry.title}`);
	console.log(`  commit: ${result.entry.sourceCommitUrl}`);
	console.log(`  diffFile: ${result.entry.diffFile}`);
	console.log(`  metadataFile: ${result.entry.metadataFile}`);
}

if (import.meta.main) {
	main().catch((error) => {
		console.error("[benchmark:add] Failed:", toErrorMessage(error));
		process.exit(1);
	});
}
