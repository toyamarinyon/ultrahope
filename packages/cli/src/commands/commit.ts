import { execSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createApiClient,
	InsufficientBalanceError,
	type MultiModelResult,
} from "../lib/api-client";
import { getToken } from "../lib/auth";
import { type CandidateWithModel, selectCandidate } from "../lib/selector";

const DEFAULT_MODELS = [
	"mistral/mistral-nemo",
	"cerebras/llama-3.1-8b",
	"openai/gpt-5-nano",
	"xai/grok-code-fast-1",
];

interface CommitOptions {
	message: boolean;
	dryRun: boolean;
	interactive: boolean;
	n: number;
	models: string[];
}

function parseArgs(args: string[]): CommitOptions {
	let n = 4;
	let models: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-n" && args[i + 1]) {
			const value = Number.parseInt(args[i + 1], 10);
			if (!Number.isNaN(value) && value >= 1 && value <= 8) {
				n = value;
			}
			i++;
		} else if (arg === "--models" && args[i + 1]) {
			models = args[i + 1].split(",").map((m) => m.trim());
			i++;
		}
	}

	if (models.length === 0) {
		models = DEFAULT_MODELS;
	}

	return {
		message: args.includes("-m") || args.includes("--message"),
		dryRun: args.includes("--dry-run"),
		interactive: !args.includes("--no-interactive"),
		n,
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

async function generateCommitMessages(
	diff: string,
	models: string[],
): Promise<CandidateWithModel[]> {
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
			models,
		});
		if ("results" in result) {
			return result.results.map((r: MultiModelResult) => ({
				content: r.output,
				model: r.model,
				cost: r.cost,
			}));
		}
		if ("outputs" in result) {
			return result.outputs.map((output: string) => ({ content: output }));
		}
		return [{ content: result.output }];
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

	if (!options.interactive) {
		const candidates = await generateCommitMessages(
			diff,
			options.models.slice(0, 1),
		);
		const message = candidates[0]?.content ?? "";

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

	let candidates = await generateCommitMessages(diff, options.models);

	if (options.dryRun) {
		for (const candidate of candidates) {
			console.log("---");
			console.log(candidate.content);
		}
		return;
	}

	while (true) {
		const result = await selectCandidate({
			candidates,
			prompt: "Select a commit message:",
		});

		if (result.action === "abort") {
			console.error("Aborting commit.");
			process.exit(1);
		}

		if (result.action === "reroll") {
			candidates = await generateCommitMessages(diff, options.models);
			continue;
		}

		if (result.action === "confirm" && result.selected) {
			if (options.message) {
				commitWithMessage(result.selected);
			} else {
				const editedMessage = await openEditor(result.selected);
				if (!editedMessage) {
					console.error("Aborting commit due to empty message.");
					process.exit(1);
				}
				commitWithMessage(editedMessage);
			}
			return;
		}
	}
}
