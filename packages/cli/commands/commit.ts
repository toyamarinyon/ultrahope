import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as readline from "node:readline";
import * as tty from "node:tty";
import {
	abortReasonForError,
	isCommandExecutionAbort,
	mergeAbortSignals,
} from "../lib/abort";
import { createApiClient, InvalidModelError } from "../lib/api-client";
import { getToken } from "../lib/auth";
import {
	handleCommandExecutionError,
	startCommandExecution,
} from "../lib/command-execution";
import { parseModelsArg, resolveModels } from "../lib/config";
import { formatDiffStats, getGitStagedStats } from "../lib/diff-stats";
import { formatResetTime } from "../lib/format-time";
import { createRenderer, SPINNER_FRAMES } from "../lib/renderer";
import { type QuotaInfo, selectCandidate } from "../lib/selector";
import { createStreamCaptureRecorder } from "../lib/stream-capture";
import { ui } from "../lib/ui";
import { generateCommitMessages } from "../lib/vcs-message-generator";

interface CommitOptions {
	interactive: boolean;
	cliModels?: string[];
	captureStreamPath?: string;
	guide?: string;
}

function normalizeGuide(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.length > 1024 ? trimmed.slice(0, 1024) : trimmed;
}

function composeGuidance(
	baseGuide: string | undefined,
	guideHint: string | undefined,
): string | undefined {
	const normalizedBase = baseGuide?.trim() ?? "";
	const normalizedGuideHint = guideHint?.trim() ?? "";
	if (!normalizedBase && !normalizedGuideHint) return undefined;
	if (!normalizedBase) return normalizedGuideHint;
	if (!normalizedGuideHint) return normalizedBase;
	return `${normalizedBase}\n\nRefinement: ${normalizedGuideHint}`;
}

function exitWithInvalidModelError(error: InvalidModelError): never {
	console.error(`Error: Model '${error.model}' is not supported.`);
	if (error.allowedModels.length > 0) {
		console.error(`Available models: ${error.allowedModels.join(", ")}`);
	}
	process.exit(1);
}

function showQuotaInfo(quota: QuotaInfo): void {
	const { relative, local } = formatResetTime(quota.resetsAt);
	console.log("");
	console.log(
		ui.hint(
			`Daily quota: ${quota.remaining} of ${quota.limit} remaining. Resets ${relative} (${local}).`,
		),
	);
}

function parseArgs(args: string[]): CommitOptions {
	let cliModels: string[] | undefined;
	let captureStreamPath: string | undefined;
	let guide: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--models") {
			const value = args[i + 1];
			if (!value) {
				console.error("Error: --models requires a value");
				process.exit(1);
			}
			cliModels = parseModelsArg(value);
			i++;
		} else if (arg === "--capture-stream") {
			const value = args[i + 1];
			if (!value) {
				console.error("Error: --capture-stream requires a file path");
				process.exit(1);
			}
			captureStreamPath = value;
			i++;
		} else if (arg === "--guide") {
			const value = args[i + 1];
			if (!value) {
				console.error("Error: --guide requires a text value.");
				process.exit(1);
			}
			guide = normalizeGuide(value);
			i++;
		}
	}

	return {
		interactive: !args.includes("--no-interactive"),
		cliModels,
		captureStreamPath,
		guide,
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

function canPromptForStagedChanges(): boolean {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		return false;
	}

	try {
		fs.accessSync("/dev/tty", fs.constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

async function promptStageAllChanges(): Promise<boolean> {
	return new Promise((resolve) => {
		const fd = fs.openSync("/dev/tty", "r");
		const ttyInput = new tty.ReadStream(fd);
		const rl = readline.createInterface({
			input: ttyInput,
			output: process.stdout,
			terminal: true,
		});

		rl.question(
			ui.prompt(
				"No staged changes. Stage all files with `git add -A` and continue? (y/N) ",
			),
			(answer) => {
				rl.close();
				ttyInput.destroy();
				const normalized = answer.trim().toLowerCase();
				resolve(normalized === "y");
			},
		);
	});
}

function stageAllChanges(): void {
	try {
		execSync("git add -A", { stdio: "inherit" });
	} catch {
		console.error("Error: Failed to stage changes with `git add -A`.");
		process.exit(1);
	}
}

function commitWithMessage(message: string): string {
	try {
		return execSync(`git commit -m ${JSON.stringify(message)}`, {
			stdio: "pipe",
			encoding: "utf-8",
		}).trim();
	} catch {
		process.exit(1);
	}
}

export async function commit(args: string[]) {
	const options = parseArgs(args);
	const captureRecorder = createStreamCaptureRecorder({
		path: options.captureStreamPath,
		command: "git ultrahope commit",
		args: ["commit", ...args],
		apiPath: "/v1/commit-message/stream",
	});
	const models = resolveModels(options.cliModels);
	let diff = getStagedDiff();

	if (!diff.trim()) {
		if (!options.interactive || !canPromptForStagedChanges()) {
			console.error(
				"Error: No staged changes. Stage files with `git add` first.",
			);
			process.exit(1);
		}

		const shouldStage = await promptStageAllChanges();
		if (!shouldStage) {
			console.error(
				"Error: No staged changes. Stage files with `git add` first.",
			);
			process.exit(1);
		}

		stageAllChanges();
		diff = getStagedDiff();

		if (!diff.trim()) {
			console.error(
				"Error: No staged changes. Stage files with `git add` first.",
			);
			process.exit(1);
		}
	}

	try {
		const token = await getToken();
		if (!token) {
			console.error("Error: Not authenticated. Run `ultrahope login` first.");
			process.exit(1);
		}

		const api = createApiClient(token);
		const {
			commandExecutionPromise: promise,
			abortController,
			cliSessionId: id,
		} = startCommandExecution({
			api,
			command: "commit",
			args,
			apiPath: "/v1/commit-message",
			requestPayload: {
				input: diff,
				target: "vcs-commit-message",
				model: models[0],
				...(options.guide ? { guide: options.guide } : {}),
			},
		});

		const cliSessionId: string | undefined = id;
		const commandExecutionSignal: AbortSignal | undefined =
			abortController.signal;
		const commandExecutionPromise: Promise<unknown> | undefined = promise;
		const apiClient: ReturnType<typeof createApiClient> | null = api;
		let guideHint: string | undefined;

		commandExecutionPromise.catch(async (error) => {
			abortController.abort(abortReasonForError(error));
			await handleCommandExecutionError(error, {
				progress: { ready: 0, total: models.length },
			});
		});

		const recordSelection = async (generationId?: string) => {
			if (!generationId || !apiClient) return;
			try {
				await apiClient.recordGenerationScore({
					generationId,
					value: 1,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (message.includes("Generation not found")) {
					return;
				}
				console.error(`Warning: Failed to record selection. ${message}`);
			}
		};

		const createCandidates = (signal: AbortSignal) =>
			generateCommitMessages({
				diff,
				models,
				guide: composeGuidance(options.guide, guideHint),
				signal: mergeAbortSignals(signal, commandExecutionSignal),
				cliSessionId,
				commandExecutionPromise,
				streamCaptureRecorder: captureRecorder,
			});

		if (!options.interactive) {
			const gen = generateCommitMessages({
				diff,
				models: models.slice(0, 1),
				guide: composeGuidance(options.guide, guideHint),
				signal: commandExecutionSignal,
				cliSessionId,
				commandExecutionPromise,
				streamCaptureRecorder: captureRecorder,
			});
			const first = await gen.next().catch((error) => {
				if (error instanceof InvalidModelError) {
					exitWithInvalidModelError(error);
				}
				throw error;
			});
			await recordSelection(first.value?.generationId);
			const message = first.value?.content ?? "";
			commitWithMessage(message);
			return;
		}

		const stats = getGitStagedStats();
		console.log(ui.success(`Found ${formatDiffStats(stats)}`));

		while (true) {
			const result = await selectCandidate({
				createCandidates,
				maxSlots: models.length,
				abortSignal: commandExecutionSignal,
				models,
			});

			if (result.action === "abort") {
				if (result.error instanceof InvalidModelError) {
					exitWithInvalidModelError(result.error);
				}
				if (isCommandExecutionAbort(commandExecutionSignal)) {
					return;
				}
				console.error("Aborting commit.");
				process.exit(1);
			}

			if (result.action === "refine" && result.guide !== undefined) {
				guideHint = result.guide.trim() || undefined;
				continue;
			}

			if (result.action === "confirm" && result.selected) {
				recordSelection(result.selectedCandidate?.generationId);
				const label = `git commit -m ${JSON.stringify(result.selected)}`;
				const renderer = createRenderer(process.stderr);
				renderer.render(`${SPINNER_FRAMES[0]} ${label}\n`);
				const output = commitWithMessage(result.selected);
				renderer.clearAll();
				console.log(ui.success(label));
				if (output) {
					for (const line of output.split("\n")) {
						console.log(ui.hint(`  ${line}`));
					}
				}

				if (result.quota) {
					showQuotaInfo(result.quota);
				}
				return;
			}
		}
	} finally {
		const capturePath = captureRecorder.flush();
		if (capturePath) {
			console.log(ui.hint(`Captured stream replay to ${capturePath}`));
		}
	}
}
