import { execSync, spawnSync } from "node:child_process";
import { mergeAbortSignals } from "../lib/abort";
import { createApiClient } from "../lib/api-client";
import { getToken } from "../lib/auth";
import {
	handleCommandExecutionError,
	startCommandExecution,
} from "../lib/command-execution";
import { formatDiffStats, getJjDiffStats } from "../lib/diff-stats";
import { selectCandidate } from "../lib/selector";
import { ui } from "../lib/ui";
import {
	DEFAULT_MODELS,
	generateCommitMessages,
} from "../lib/vcs-message-generator";

interface DescribeOptions {
	revision: string;
	dryRun: boolean;
	interactive: boolean;
	mock: boolean;
	models: string[];
}

interface CommandExecutionContext {
	apiClient: ReturnType<typeof createApiClient> | null;
	commandExecutionSignal?: AbortSignal;
	commandExecutionPromise?: Promise<unknown>;
	cliSessionId?: string;
}

function parseDescribeArgs(args: string[]): DescribeOptions {
	let revision = "@";
	let dryRun = false;
	let interactive = true;
	let mock = false;
	let models: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-r") {
			revision = args[++i] || "@";
		} else if (arg === "--dry-run") {
			dryRun = true;
		} else if (arg === "--no-interactive") {
			interactive = false;
		} else if (arg === "--mock") {
			mock = true;
		} else if (arg === "--models" && args[i + 1]) {
			models = args[++i].split(",").map((m) => m.trim());
		}
	}

	if (models.length === 0) {
		models = DEFAULT_MODELS;
	}

	return { revision, dryRun, interactive, mock, models };
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
	options: DescribeOptions,
	diff: string,
): Promise<CommandExecutionContext> {
	if (options.mock) {
		return { apiClient: null };
	}

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
			apiPath: "/v1/translate",
			requestPayload: {
				input: diff,
				target: "vcs-commit-message",
				models: options.models,
			},
		});

	commandExecutionPromise.catch(async (error) => {
		abortController.abort();
		await handleCommandExecutionError(error, {
			progress: { ready: 0, total: options.models.length },
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
			comment: null,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Warning: Failed to record selection. ${message}`);
	}
}

function createCandidateFactory(
	diff: string,
	options: DescribeOptions,
	context: CommandExecutionContext,
) {
	return (signal: AbortSignal) =>
		generateCommitMessages({
			diff,
			models: options.models,
			mock: options.mock,
			signal: mergeAbortSignals(signal, context.commandExecutionSignal),
			cliSessionId: context.cliSessionId,
			commandExecutionPromise: context.commandExecutionPromise,
		});
}

async function runNonInteractiveDescribe(
	options: DescribeOptions,
	diff: string,
	context: CommandExecutionContext,
): Promise<void> {
	const gen = generateCommitMessages({
		diff,
		models: options.models.slice(0, 1),
		mock: options.mock,
		signal: context.commandExecutionSignal,
		cliSessionId: context.cliSessionId,
		commandExecutionPromise: context.commandExecutionPromise,
	});
	const first = await gen.next();
	await recordSelection(context.apiClient, first.value?.generationId);
	const message = first.value?.content ?? "";

	if (options.dryRun) {
		console.log(message);
		return;
	}

	describeRevision(options.revision, message);
}

async function runDryRunDescribe(
	createCandidates: (
		signal: AbortSignal,
	) => ReturnType<typeof generateCommitMessages>,
	context: CommandExecutionContext,
): Promise<void> {
	const abortController = new AbortController();
	const mergedSignal = mergeAbortSignals(
		abortController.signal,
		context.commandExecutionSignal,
	);
	for await (const candidate of createCandidates(
		mergedSignal ?? abortController.signal,
	)) {
		console.log("---");
		console.log(candidate.content);
	}
}

async function runInteractiveDescribe(
	options: DescribeOptions,
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
			maxSlots: options.models.length,
			abortSignal: context.commandExecutionSignal,
		});

		if (result.action === "abort") {
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
			console.log(ui.success("Message selected"));
			console.log(
				`${ui.success(`Running jj describe -r ${options.revision}`)}\n`,
			);
			describeRevision(options.revision, result.selected);
			return;
		}
	}
}

async function describe(args: string[]) {
	const options = parseDescribeArgs(args);
	const diff = getJjDiff(options.revision);
	assertDiffAvailable(options.revision, diff);

	const context = await initCommandExecutionContext(args, options, diff);
	const createCandidates = createCandidateFactory(diff, options, context);

	if (!options.interactive) {
		await runNonInteractiveDescribe(options, diff, context);
		return;
	}

	if (options.dryRun) {
		await runDryRunDescribe(createCandidates, context);
		return;
	}

	await runInteractiveDescribe(options, createCandidates, context);
}

function printHelp() {
	console.log(`Usage: ultrahope jj <command>

Commands:
  describe    Generate commit description from changes

Describe options:
  -r <revset>       Revision to describe (default: @)
  --dry-run         Print candidates only, don't describe
  --no-interactive  Single candidate, no selection
  --mock            Use mock API for testing (no LLM tokens consumed)

Examples:
  ultrahope jj describe              # interactive mode
  ultrahope jj describe -r @-        # for parent revision
  ultrahope jj describe --dry-run    # print candidates only
  ultrahope jj describe --mock       # test with mock responses`);
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
