import { execFileSync, execSync, spawnSync } from "node:child_process";
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
import { formatDiffStats, getJjDiffStats } from "../lib/diff-stats";
import { formatResetTime } from "../lib/format-time";
import { createRenderer, SPINNER_FRAMES } from "../lib/renderer";
import {
	type QuotaInfo,
	type SelectorResult,
	selectCandidate,
} from "../lib/selector";
import { createStreamCaptureRecorder } from "../lib/stream-capture";
import { ui } from "../lib/ui";
import { generateCommitMessages } from "../lib/vcs-message-generator";

interface DescribeOptions {
	revision: string;
	cliModels?: string[];
	captureStreamPath?: string;
	guide?: string;
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

interface CommandExecutionContext {
	apiClient: ReturnType<typeof createApiClient> | null;
	commandExecutionSignal?: AbortSignal;
	commandExecutionPromise?: Promise<unknown>;
	cliSessionId?: string;
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

function parseDescribeArgs(args: string[]): DescribeOptions {
	let revision = "@";
	let cliModels: string[] | undefined;
	let captureStreamPath: string | undefined;
	let guide: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-r") {
			revision = args[++i] || "@";
		} else if (arg === "--no-interactive") {
			console.error(
				"Error: --no-interactive is no longer supported. Use interactive mode only.",
			);
			process.exit(1);
		} else if (arg === "--models") {
			const value = args[++i];
			if (!value) {
				console.error("Error: --models requires a value");
				process.exit(1);
			}
			cliModels = parseModelsArg(value);
		} else if (arg === "--capture-stream") {
			const value = args[++i];
			if (!value) {
				console.error("Error: --capture-stream requires a file path");
				process.exit(1);
			}
			captureStreamPath = value;
		} else if (arg === "--guide") {
			const value = args[++i];
			if (!value) {
				console.error("Error: --guide requires a text value.");
				process.exit(1);
			}
			guide = normalizeGuide(value);
		}
	}

	return { revision, cliModels, captureStreamPath, guide };
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

function describeRevision(revision: string, message: string): string {
	try {
		const result = spawnSync(
			"jj",
			["describe", "-r", revision, "-m", message],
			{ stdio: "pipe", encoding: "utf-8" },
		);
		return [result.stdout, result.stderr].filter(Boolean).join("").trim();
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
	guide?: string,
	apiPath: string,
	isSessionActive?: () => boolean,
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
			apiPath,
			requestPayload: {
				input: diff,
				target: "vcs-commit-message",
				models,
				...(guide ? { guide } : {}),
			},
		});

	commandExecutionPromise.catch(async (error) => {
		if (isSessionActive && !isSessionActive()) {
			return;
		}
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
	captureRecorder: ReturnType<typeof createStreamCaptureRecorder>,
	baseGuide?: string,
	refineMessage?: string,
) {
	return (signal: AbortSignal, guideHint?: string) =>
		generateCommitMessages({
			diff,
			models,
			guide: composeGuidance(baseGuide, guideHint),
			signal: mergeAbortSignals(signal, context.commandExecutionSignal),
			cliSessionId: context.cliSessionId,
			commandExecutionPromise: context.commandExecutionPromise,
			useStream: true,
			streamCaptureRecorder: captureRecorder,
			refine: refineMessage
				? {
						originalMessage: refineMessage,
						refineInstruction: guideHint,
					}
				: undefined,
		});
}

async function runInteractiveDescribe(
	models: string[],
	createCandidates: (
		signal: AbortSignal,
		guideHint?: string,
	) => ReturnType<typeof generateCommitMessages>,
	context: CommandExecutionContext,
	guideHint?: string,
): Promise<SelectorResult> {
	return selectCandidate({
		createCandidates,
		maxSlots: models.length,
		abortSignal: context.commandExecutionSignal,
		models,
		inlineEditPrompt: true,
		initialGuideHint: guideHint,
	});
}

async function describe(args: string[]) {
	const options = parseDescribeArgs(args);
	const models = resolveModels(options.cliModels);
	const diff = getJjDiff(options.revision);
	assertDiffAvailable(options.revision, diff);
	const captureRecorder = createStreamCaptureRecorder({
		path: options.captureStreamPath,
		command: "ultrahope jj describe",
		args: ["describe", ...args],
		apiPath: "/v1/commit-message/stream",
	});

	try {
		const stats = getJjDiffStats(options.revision);
		console.log(ui.success(`Found ${formatDiffStats(stats)}`));

		let guideHint: string | undefined;
		let refineMessage: string | undefined;
		let commandExecutionRun = 0;
		while (true) {
			const sessionId = ++commandExecutionRun;
			const isRefineAttempt = refineMessage !== undefined;
			const context = await initCommandExecutionContext(
				args,
				models,
				diff,
				composeGuidance(options.guide, guideHint),
				isRefineAttempt
					? "/v1/commit-message/refine"
					: "/v1/commit-message/stream",
				() => sessionId === commandExecutionRun,
			);
			const createCandidates = createCandidateFactory(
				diff,
				models,
				context,
				captureRecorder,
				options.guide,
				refineMessage,
			);
			const result = await runInteractiveDescribe(
				models,
				createCandidates,
				context,
				guideHint,
			);

			if (result.action === "abort") {
				if (result.error instanceof InvalidModelError) {
					exitWithInvalidModelError(result.error);
				}
				if (isCommandExecutionAbort(context.commandExecutionSignal)) {
					return;
				}
				console.error("Aborted.");
				process.exit(1);
			}

			if (result.action === "refine") {
				guideHint = result.guide;
				refineMessage = result.selected ?? result.selectedCandidate?.content;
				continue;
			}

			if (result.action === "confirm" && result.selected) {
				recordSelection(
					context.apiClient,
					result.selectedCandidate?.generationId,
				);
				const label = `jj describe -r ${options.revision} -m ${JSON.stringify(result.selected)}`;
				const renderer = createRenderer(process.stderr);
				renderer.render(`${SPINNER_FRAMES[0]} ${label}\n`);
				const output = describeRevision(options.revision, result.selected);
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

function setup() {
	try {
		const existing = execFileSync(
			"jj",
			["config", "get", "aliases.ultrahope"],
			{ encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
		).trim();
		if (existing) {
			console.log(ui.success("jj alias 'ultrahope' is already configured."));
			console.log(ui.hint("  Run `jj ultrahope describe` to use it."));
			return;
		}
	} catch {
		// alias not set yet
	}

	execFileSync(
		"jj",
		[
			"config",
			"set",
			"--user",
			"aliases.ultrahope",
			'["util", "exec", "--", "ultrahope", "jj"]',
		],
		{ stdio: "inherit" },
	);
	console.log(ui.success("Added jj alias 'ultrahope'."));
	console.log(
		ui.hint(
			"  You can now run `jj ultrahope describe` instead of `ultrahope jj describe`.",
		),
	);
}

function printHelp() {
	console.log(`Usage: ultrahope jj <command>

Commands:
   describe    Generate commit description from changes
   setup       Register 'ultrahope' as a jj alias

Describe options:
   -r <revset>       Revision to describe (default: @)
   --guide <text>     Additional context to guide message generation
   --models <list>   Comma-separated model list (overrides config)
   --capture-stream <path>  Save candidate stream as replay JSON

Examples:
   ultrahope jj describe              # interactive mode
   ultrahope jj describe -r @-        # for parent revision
   ultrahope jj describe --guide "GHSA-gq3j-xvxp-8hrf: override reason"
   ultrahope jj describe --capture-stream packages/web/lib/demo/commit-message-stream.capture.json
   ultrahope jj setup                 # enable \`jj ultrahope\` alias`);
}

export async function jj(args: string[]) {
	const [command, ...rest] = args;

	switch (command) {
		case "describe":
			await describe(rest);
			break;
		case "setup":
			setup();
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
