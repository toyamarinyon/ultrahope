import { execSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatDiffStats, getGitStagedStats } from "../lib/diff-stats";
import { selectCandidate } from "../lib/selector";
import {
	DEFAULT_MODELS,
	generateCommitMessages,
} from "../lib/vcs-message-generator";

interface CommitOptions {
	message: boolean;
	dryRun: boolean;
	interactive: boolean;
	mock: boolean;
	models: string[];
}

function parseArgs(args: string[]): CommitOptions {
	let models: string[] = [];
	let mock = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--models" && args[i + 1]) {
			models = args[i + 1].split(",").map((m) => m.trim());
			i++;
		} else if (arg === "--mock") {
			mock = true;
		}
	}

	if (models.length === 0) {
		models = DEFAULT_MODELS;
	}

	return {
		message: args.includes("-m") || args.includes("--message"),
		dryRun: args.includes("--dry-run"),
		interactive: !args.includes("--no-interactive"),
		mock,
		models,
	};
}

function getStagedDiff(): string {
	try {
		return execSync("git diff --cached", { encoding: "utf-8" });
	} catch {
		console.error(
			"Error: Failed to get staged changes. Are you in a git repository?",
		);
		process.exit(1);
	}
}

function openEditor(initialMessage: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const editor = process.env.GIT_EDITOR || process.env.EDITOR || "vi";
		const tmpDir = mkdtempSync(join(tmpdir(), "ultrahope-"));
		const tmpFile = join(tmpDir, "COMMIT_EDITMSG");

		writeFileSync(tmpFile, initialMessage);

		const child = spawn(editor, [tmpFile], {
			stdio: "inherit",
		});

		child.on("close", (code) => {
			if (code !== 0) {
				unlinkSync(tmpFile);
				reject(new Error(`Editor exited with code ${code}`));
				return;
			}
			const message = readFileSync(tmpFile, "utf-8").trim();
			unlinkSync(tmpFile);
			resolve(message);
		});

		child.on("error", (err) => {
			unlinkSync(tmpFile);
			reject(err);
		});
	});
}

function commitWithMessage(message: string): void {
	try {
		execSync(`git commit -m ${JSON.stringify(message)}`, { stdio: "inherit" });
	} catch {
		process.exit(1);
	}
}

export async function commit(args: string[]) {
	const options = parseArgs(args);
	const diff = getStagedDiff();

	if (!diff.trim()) {
		console.error(
			"Error: No staged changes. Stage files with `git add` first.",
		);
		process.exit(1);
	}

	const createGenerator = () =>
		generateCommitMessages({
			diff,
			models: options.models,
			mock: options.mock,
		});

	if (!options.interactive) {
		const gen = generateCommitMessages({
			diff,
			models: options.models.slice(0, 1),
			mock: options.mock,
		});
		const first = await gen.next();
		const message = first.value?.content ?? "";

		if (options.dryRun) {
			console.log(message);
			return;
		}

		if (options.message) {
			commitWithMessage(message);
			return;
		}

		const editedMessage = await openEditor(message);
		if (!editedMessage) {
			console.error("Aborting commit due to empty message.");
			process.exit(1);
		}
		commitWithMessage(editedMessage);
		return;
	}

	if (options.dryRun) {
		for await (const candidate of createGenerator()) {
			console.log("---");
			console.log(candidate.content);
		}
		return;
	}

	const stats = getGitStagedStats();
	console.log(`\x1b[32m✔\x1b[0m Found ${formatDiffStats(stats)}`);

	while (true) {
		const result = await selectCandidate({
			candidates: createGenerator(),
			maxSlots: options.models.length,
		});

		if (result.action === "abort") {
			console.error("Aborting commit.");
			process.exit(1);
		}

		if (result.action === "reroll") {
			continue;
		}

		if (result.action === "confirm" && result.selected) {
			console.log(`\x1b[32m✔\x1b[0m Message selected`);
			if (options.message) {
				console.log(`\x1b[32m✔\x1b[0m Running git commit\n`);
				commitWithMessage(result.selected);
			} else {
				const editedMessage = await openEditor(result.selected);
				if (!editedMessage) {
					console.error("Aborting commit due to empty message.");
					process.exit(1);
				}
				console.log(`\x1b[32m✔\x1b[0m Running git commit\n`);
				commitWithMessage(editedMessage);
			}
			return;
		}
	}
}
