import { execSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeAbortSignals } from "../lib/abort";
import { createApiClient } from "../lib/api-client";
import { getToken } from "../lib/auth";
import {
	handleCommandExecutionError,
	startCommandExecution,
} from "../lib/command-execution";
import { formatDiffStats, getGitStagedStats } from "../lib/diff-stats";
import { selectCandidate } from "../lib/selector";
import { ui } from "../lib/ui";
import {
	DEFAULT_MODELS,
	generateCommitMessages,
} from "../lib/vcs-message-generator";

interface CommitOptions {
	message: boolean;
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

	let cliSessionId: string | undefined;
	let commandExecutionSignal: AbortSignal | undefined;
	let commandExecutionPromise: Promise<unknown> | undefined;
	let apiClient: ReturnType<typeof createApiClient> | null = null;

	if (!options.mock) {
		const token = await getToken();
		if (!token) {
			console.error("Error: Not authenticated. Run `ultrahope login` first.");
			process.exit(1);
		}

		const api = createApiClient(token);
		apiClient = api;
		const {
			commandExecutionPromise: promise,
			abortController,
			cliSessionId: id,
		} = startCommandExecution({
			api,
			command: "commit",
			args,
			apiPath: "/v1/translate",
			requestPayload: {
				input: diff,
				target: "vcs-commit-message",
				models: options.models,
			},
		});

		commandExecutionPromise = promise;
		commandExecutionPromise.catch(async (error) => {
			abortController.abort();
			await handleCommandExecutionError(error, {
				progress: { ready: 0, total: options.models.length },
			});
		});

		cliSessionId = id;
		commandExecutionSignal = abortController.signal;
	}

	const recordSelection = async (generationId?: string) => {
		if (!generationId || !apiClient) return;
		try {
			await apiClient.recordGenerationScore({
				generationId,
				value: 1,
				comment: null,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`Warning: Failed to record selection. ${message}`);
		}
	};

	const createCandidates = (signal: AbortSignal) =>
		generateCommitMessages({
			diff,
			models: options.models,
			mock: options.mock,
			signal: mergeAbortSignals(signal, commandExecutionSignal),
			cliSessionId,
			commandExecutionPromise,
		});

	if (!options.interactive) {
		const gen = generateCommitMessages({
			diff,
			models: options.models.slice(0, 1),
			mock: options.mock,
			signal: commandExecutionSignal,
			cliSessionId,
			commandExecutionPromise,
		});
		const first = await gen.next();
		await recordSelection(first.value?.generationId);
		const message = first.value?.content ?? "";

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

	const stats = getGitStagedStats();
	console.log(ui.success(`Found ${formatDiffStats(stats)}`));

	while (true) {
		const result = await selectCandidate({
			createCandidates,
			maxSlots: options.models.length,
			abortSignal: commandExecutionSignal,
		});

		if (result.action === "abort") {
			console.error("Aborting commit.");
			process.exit(1);
		}

		if (result.action === "reroll") {
			continue;
		}

		if (result.action === "confirm" && result.selected) {
			await recordSelection(result.selectedCandidate?.generationId);
			console.log(ui.success("Message selected"));
			if (options.message) {
				console.log(`${ui.success("Running git commit")}\n`);
				commitWithMessage(result.selected);
			} else {
				const editedMessage = await openEditor(result.selected);
				if (!editedMessage) {
					console.error("Aborting commit due to empty message.");
					process.exit(1);
				}
				console.log(`${ui.success("Running git commit")}\n`);
				commitWithMessage(editedMessage);
			}
			return;
		}
	}
}
