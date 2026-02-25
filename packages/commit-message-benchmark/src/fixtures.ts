import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import type { FixtureScenario, FixtureScenarioIndexEntry } from "./types";

export const DEFAULT_FIXTURE_SET = "react";

function ensureFixtureSetName(setName: string): string {
	const trimmed = setName.trim();
	if (!trimmed) {
		throw new Error("Fixture set name must not be empty.");
	}
	if (!/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) {
		throw new Error(
			`Fixture set name '${setName}' is invalid. Use letters, numbers, or '-'.`,
		);
	}
	return trimmed;
}

function ensureFixturePathSegment(value: string, label: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${label} must not be empty.`);
	}
	if (!/^[a-z0-9][a-z0-9._-]*$/i.test(trimmed)) {
		throw new Error(
			`${label} '${value}' is invalid. Use letters, numbers, '.', '_' or '-'.`,
		);
	}
	return trimmed.toLowerCase();
}

function getFixtureSetDir(setName = DEFAULT_FIXTURE_SET): URL {
	const safeSetName = ensureFixtureSetName(setName);
	return new URL(`../fixtures/${safeSetName}/`, import.meta.url);
}

function getFixtureSetIndexPath(setName = DEFAULT_FIXTURE_SET): URL {
	return new URL("index.json", getFixtureSetDir(setName));
}

function getFixtureSetFilePath(
	relativePath: string,
	setName = DEFAULT_FIXTURE_SET,
): URL {
	return new URL(relativePath, getFixtureSetDir(setName));
}

export function normalizeGitHubFixtureNamespace(args: {
	owner: string;
	repo: string;
}): { owner: string; repo: string } {
	return {
		owner: ensureFixturePathSegment(args.owner, "GitHub owner"),
		repo: ensureFixturePathSegment(args.repo, "GitHub repo"),
	};
}

function getGitHubRepoFixtureDir(args: { owner: string; repo: string }): URL {
	const namespace = normalizeGitHubFixtureNamespace(args);
	return new URL(
		`../fixtures/github/${namespace.owner}/${namespace.repo}/`,
		import.meta.url,
	);
}

function getGitHubFixtureRootDir(): URL {
	return new URL("../fixtures/github/", import.meta.url);
}

export function getGitHubRepoFixtureIndexPath(args: {
	owner: string;
	repo: string;
}): URL {
	return new URL("index.json", getGitHubRepoFixtureDir(args));
}

export function getGitHubRepoFixtureFilePath(
	relativePath: string,
	args: {
		owner: string;
		repo: string;
	},
): URL {
	return new URL(relativePath, getGitHubRepoFixtureDir(args));
}

async function readJsonFile<T>(path: URL): Promise<T> {
	const text = await readFile(path, "utf8");
	return JSON.parse(text) as T;
}

export async function writeJsonFile(
	path: URL,
	payload: unknown,
): Promise<void> {
	await mkdir(new URL(".", path), { recursive: true });
	await writeFile(path, `${JSON.stringify(payload, null, "\t")}\n`, "utf8");
}

async function loadFixtureIndex(
	setName = DEFAULT_FIXTURE_SET,
	options?: { allowMissing?: boolean },
): Promise<FixtureScenarioIndexEntry[]> {
	try {
		return await readJsonFile<FixtureScenarioIndexEntry[]>(
			getFixtureSetIndexPath(setName),
		);
	} catch (error) {
		const code = (error as NodeJS.ErrnoException | undefined)?.code;
		if (options?.allowMissing && code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

export async function loadGitHubRepoFixtureIndex(
	args: {
		owner: string;
		repo: string;
	},
	options?: { allowMissing?: boolean },
): Promise<FixtureScenarioIndexEntry[]> {
	try {
		return await readJsonFile<FixtureScenarioIndexEntry[]>(
			getGitHubRepoFixtureIndexPath(args),
		);
	} catch (error) {
		const code = (error as NodeJS.ErrnoException | undefined)?.code;
		if (options?.allowMissing && code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

export async function saveGitHubRepoFixtureIndex(args: {
	owner: string;
	repo: string;
	entries: FixtureScenarioIndexEntry[];
}): Promise<void> {
	await writeJsonFile(getGitHubRepoFixtureIndexPath(args), args.entries);
}

export async function loadFixtureScenarios(
	setName = DEFAULT_FIXTURE_SET,
): Promise<FixtureScenario[]> {
	const index = await loadFixtureIndex(setName);
	const scenarios: FixtureScenario[] = [];

	for (const entry of index) {
		const diff = await readFile(
			getFixtureSetFilePath(entry.diffFile, setName),
			"utf8",
		);
		scenarios.push({
			id: entry.id,
			title: entry.title,
			sourceRepo: entry.sourceRepo,
			sourceCommitUrl: entry.sourceCommitUrl,
			diff,
		});
	}

	return scenarios;
}

export async function loadGitHubRepoFixtureScenarios(args: {
	owner: string;
	repo: string;
	options?: { allowMissing?: boolean };
}): Promise<FixtureScenario[]> {
	const index = await loadGitHubRepoFixtureIndex(args, {
		allowMissing: args.options?.allowMissing,
	});
	const scenarios: FixtureScenario[] = [];

	for (const entry of index) {
		const diff = await readFile(
			getGitHubRepoFixtureFilePath(entry.diffFile, args),
			"utf8",
		);
		scenarios.push({
			id: entry.id,
			title: entry.title,
			sourceRepo: entry.sourceRepo,
			sourceCommitUrl: entry.sourceCommitUrl,
			diff,
		});
	}

	return scenarios;
}

async function listDirectoryNames(path: URL): Promise<string[]> {
	try {
		const entries = await readdir(path, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort((a, b) => a.localeCompare(b));
	} catch (error) {
		const code = (error as NodeJS.ErrnoException | undefined)?.code;
		if (code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

export async function loadAllGitHubFixtureScenarios(): Promise<
	FixtureScenario[]
> {
	const scenarios: FixtureScenario[] = [];
	const rootDir = getGitHubFixtureRootDir();
	const owners = await listDirectoryNames(rootDir);

	for (const owner of owners) {
		const ownerDir = new URL(`${owner}/`, rootDir);
		const repos = await listDirectoryNames(ownerDir);
		for (const repo of repos) {
			const repoScenarios = await loadGitHubRepoFixtureScenarios({
				owner,
				repo,
				options: { allowMissing: true },
			});
			scenarios.push(...repoScenarios);
		}
	}

	return scenarios;
}
