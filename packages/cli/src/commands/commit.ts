import { execSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApiClient, InsufficientBalanceError } from "../lib/api-client";
import { getToken } from "../lib/auth";

interface CommitOptions {
	message: boolean;
	dryRun: boolean;
}

function parseArgs(args: string[]): CommitOptions {
	return {
		message: args.includes("-m") || args.includes("--message"),
		dryRun: args.includes("--dry-run"),
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

async function generateCommitMessage(diff: string): Promise<string> {
	const token = await getToken();
	if (!token) {
		console.error("Error: Not authenticated. Run `ultrahope login` first.");
		process.exit(1);
	}

	const api = createApiClient(token);
	try {
		const result = await api.translate({
			input: diff,
			target: "vcs-commit-message",
		});
		return result.output;
	} catch (error) {
		if (error instanceof InsufficientBalanceError) {
			console.error(
				"Error: Token balance exhausted. Upgrade your plan at https://ultrahope.dev/pricing",
			);
			process.exit(1);
		}
		throw error;
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

	const message = await generateCommitMessage(diff);

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
}
