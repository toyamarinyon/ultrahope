import { randomUUID } from "node:crypto";
import type { createApiClient } from "./api-client";
import {
	type CommandExecutionRequest,
	type CommandExecutionResponse,
	DailyLimitExceededError,
	UnauthorizedError,
} from "./api-client";
import { showDailyLimitPrompt } from "./daily-limit-prompt";

type ApiClient = ReturnType<typeof createApiClient>;

type CommandExecutionContext = {
	commandExecutionId: string;
	cliSessionId: string;
	abortController: AbortController;
	commandExecutionPromise: Promise<CommandExecutionResponse>;
};

type StartCommandExecutionOptions = {
	api: ApiClient;
	command: string;
	args: string[];
	apiPath: string;
	requestPayload: CommandExecutionRequest["requestPayload"];
};

export function startCommandExecution(
	options: StartCommandExecutionOptions,
): CommandExecutionContext {
	const commandExecutionId = randomUUID();
	const cliSessionId = commandExecutionId;
	const abortController = new AbortController();

	const commandExecutionPromise = options.api.commandExecution({
		commandExecutionId,
		cliSessionId,
		command: options.command,
		args: options.args,
		api: options.apiPath,
		requestPayload: options.requestPayload,
	});

	return {
		commandExecutionId,
		cliSessionId,
		abortController,
		commandExecutionPromise,
	};
}

export async function handleCommandExecutionError(
	error: unknown,
	options?: {
		additionalLinesToClear?: number;
		progress?: { ready: number; total: number };
	},
): Promise<never> {
	if (error instanceof UnauthorizedError) {
		const additionalLines = options?.additionalLinesToClear ?? 0;
		if (additionalLines > 0) {
			process.stdout.write(`\x1b[${additionalLines}A`);
			process.stdout.write("\x1b[0J");
		}
		console.error(
			"\x1b[31m✖\x1b[0m Unauthorized. Your session may have expired.",
		);
		console.error("");
		console.error(
			"\x1b[2mPlease run the following command to re-authenticate:\x1b[0m",
		);
		console.error("");
		console.error("  \x1b[36multrahope login\x1b[0m");
		console.error("");
		process.exit(1);
	}

	if (error instanceof DailyLimitExceededError) {
		await showDailyLimitPrompt({
			count: error.count,
			limit: error.limit,
			resetsAt: error.resetsAt,
			progress: options?.progress,
		});
		process.exit(1);
	}

	const message = error instanceof Error ? error.message : String(error);
	console.error(`Error: Failed to start command execution. ${message}`);
	process.exit(1);
}
