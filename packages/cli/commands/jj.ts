import { execSync, spawnSync } from "node:child_process";
import {
	abortReasonForError,
	isCommandExecutionAbort,
	mergeAbortSignals,
} from "../lib/abort";
import { createApiClient } from "../lib/api-client";
import { getToken } from "../lib/auth";
import {
	handleCommandExecutionError,
	startCommandExecution,
} from "../lib/command-execution";
import { parseModelsArg, resolveModels } from "../lib/config";
import { formatDiffStats, getJjDiffStats } from "../lib/diff-stats";
import { formatResetTime } from "../lib/format-time";
import { type QuotaInfo, selectCandidate } from "../lib/selector";
import { formatTotalCost, ui } from "../lib/ui";
import { generateCommitMessages } from "../lib/vcs-message-generator";

interface DescribeOptions {
	revision: string;
	interactive: boolean;
	cliModels?: string[];
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

interface CommandExecutionContext {
	apiClient: ReturnType<typeof createApiClient> | null;
	commandExecutionSignal?: AbortSignal;
	commandExecutionPromise?: Promise<unknown>;
	cliSessionId?: string;
}

function parseDescribeArgs(args: string[]): DescribeOptions {
	let revision = "@";
	let interactive = true;
	let cliModels: string[] | undefined;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-r") {
			revision = args[++i] || "@";
		} else if (arg === "--no-interactive") {
			interactive = false;
		} else if (arg === "--models") {
			const value = args[++i];
			if (!value) {
				console.error("Error: --models requires a value");
				process.exit(1);
			}
			cliModels = parseModelsArg(value);
		}
	}

	return { revision, interactive, cliModels };
}

function getJjDiff(revision: string): string {
	try {
		return execSync(`jj diff -r ${revision} --git`, { encoding: "utf-8" });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (
			message.includes("command not found") ||
			message.includes("not recognized")
		) {
			console.error("Error: jj is not installed or not in PATH.");
		} else if (message.includes("not a valid repository")) {
			console.error("Error: Not a jj repository.");
		} else {
			console.error(`Error: Failed to get diff for revision ${revision}.`);
		}
		process.exit(1);
	}
}

function describeRevision(revision: string, message: string): void {
	try {
		spawnSync("jj", ["describe", "-r", revision, "-m", message], {
			stdio: "inherit",
		});
	} catch {
		process.exit(1);
	}
}

function assertDiffAvailable(revision: string, diff: string): void {
	if (!diff.trim()) {
		console.error(`Error: No changes in revision ${revision}.`);
		process.exit(1);
	}
}

async function initCommandExecutionContext(
	args: string[],
	models: string[],
	diff: string,
): Promise<CommandExecutionContext> {
	const token = await getToken();
	if (!token) {
		console.error("Error: Not authenticated. Run `ultrahope login` first.");
		process.exit(1);
	}

	const api = createApiClient(token);
	const { commandExecutionPromise, abortController, cliSessionId } =
		startCommandExecution({
			api,
			command: "jj",
			args: ["describe", ...args],
			apiPath: "/v1/commit-message/stream",
			requestPayload: {
				input: diff,
				target: "vcs-commit-message",
				models,
			},
		});

	commandExecutionPromise.catch(async (error) => {
		abortController.abort(abortReasonForError(error));
		await handleCommandExecutionError(error, {
			progress: { ready: 0, total: models.length },
		});
	});

	return {
		apiClient: api,
		commandExecutionSignal: abortController.signal,
		commandExecutionPromise,
		cliSessionId,
	};
}

async function recordSelection(
	apiClient: CommandExecutionContext["apiClient"],
	generationId?: string,
): Promise<void> {
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
}

function createCandidateFactory(
	diff: string,
	models: string[],
	context: CommandExecutionContext,
) {
	return (signal: AbortSignal) =>
		generateCommitMessages({
			diff,
			models,
			signal: mergeAbortSignals(signal, context.commandExecutionSignal),
			cliSessionId: context.cliSessionId,
			commandExecutionPromise: context.commandExecutionPromise,
			useStream: true,
		});
}

async function runNonInteractiveDescribe(
	revision: string,
	models: string[],
	diff: string,
	context: CommandExecutionContext,
): Promise<void> {
	const gen = generateCommitMessages({
		diff,
		models: models.slice(0, 1),
		signal: context.commandExecutionSignal,
		cliSessionId: context.cliSessionId,
		commandExecutionPromise: context.commandExecutionPromise,
		useStream: true,
	});
	const first = await gen.next();
	await recordSelection(context.apiClient, first.value?.generationId);
	const message = first.value?.content ?? "";

	describeRevision(revision, message);
}

async function runInteractiveDescribe(
	options: DescribeOptions,
	models: string[],
	createCandidates: (
		signal: AbortSignal,
	) => ReturnType<typeof generateCommitMessages>,
	context: CommandExecutionContext,
): Promise<void> {
	const stats = getJjDiffStats(options.revision);
	console.log(ui.success(`Found ${formatDiffStats(stats)}`));

	while (true) {
		const result = await selectCandidate({
			createCandidates,
			maxSlots: models.length,
			abortSignal: context.commandExecutionSignal,
			models,
		});

		if (result.action === "abort") {
			if (isCommandExecutionAbort(context.commandExecutionSignal)) {
				return;
			}
			console.error("Aborted.");
			process.exit(1);
		}

		if (result.action === "reroll") {
			continue;
		}

		if (result.action === "confirm" && result.selected) {
			await recordSelection(
				context.apiClient,
				result.selectedCandidate?.generationId,
			);
			const costLabel =
				result.totalCost != null
					? ` (total: ${formatTotalCost(result.totalCost)})`
					: "";
			console.log(ui.success(`Message selected${costLabel}`));
			console.log(
				`${ui.success(`Running jj describe -r ${options.revision}`)}\n`,
			);
			describeRevision(options.revision, result.selected);

			if (result.quota) {
				showQuotaInfo(result.quota);
			}
			return;
		}
	}
}

async function describe(args: string[]) {
	const options = parseDescribeArgs(args);
	const models = resolveModels(options.cliModels);
	const diff = getJjDiff(options.revision);
	assertDiffAvailable(options.revision, diff);

	const context = await initCommandExecutionContext(args, models, diff);
	const createCandidates = createCandidateFactory(diff, models, context);

	if (!options.interactive) {
		await runNonInteractiveDescribe(options.revision, models, diff, context);
		return;
	}

	await runInteractiveDescribe(options, models, createCandidates, context);
}

function printHelp() {
	console.log(`Usage: ultrahope jj <command>

Commands:
   describe    Generate commit description from changes

Describe options:
   -r <revset>       Revision to describe (default: @)
   --no-interactive  Single candidate, no selection
   --models <list>   Comma-separated model list (overrides config)

Examples:
   ultrahope jj describe              # interactive mode
   ultrahope jj describe -r @-        # for parent revision`);
}

export async function jj(args: string[]) {
	const [command, ...rest] = args;

	switch (command) {
		case "describe":
			await describe(rest);
			break;
		case "--help":
		case "-h":
		case undefined:
			printHelp();
			break;
		default:
			console.error(`Unknown command: ${command}`);
			console.error("Run `ultrahope jj --help` for usage.");
			process.exit(1);
	}
}
