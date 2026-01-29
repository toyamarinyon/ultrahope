import { randomUUID } from "node:crypto";
import type { createApiClient } from "./api-client";
import {
	type CommandExecutionRequest,
	type CommandExecutionResponse,
	DailyLimitExceededError,
	UnauthorizedError,
} from "./api-client";
import { clearRenderedOutput } from "./selector";

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

export function handleCommandExecutionError(
	error: unknown,
	options?: { additionalLinesToClear?: number },
): never {
	if (error instanceof UnauthorizedError) {
		clearRenderedOutput();
		const additionalLines = options?.additionalLinesToClear ?? 0;
		if (additionalLines > 0) {
			process.stdout.write(`\x1b[${additionalLines}A`);
			process.stdout.write("\x1b[0J");
		}
		console.error("Error: Unauthorized. Your session may have expired.");
		console.error("");
		console.error("Please run the following command to re-authenticate:");
		console.error("");
		console.error("  ultrahope login");
		console.error("");
		process.exit(1);
	}

	if (error instanceof DailyLimitExceededError) {
		const reset = error.resetsAt ? ` (resets at ${error.resetsAt})` : "";
		console.error(
			`Error: Daily request limit reached (${error.count}/${error.limit})${reset}.`,
		);
		process.exit(1);
	}

	const message = error instanceof Error ? error.message : String(error);
	console.error(`Error: Failed to start command execution. ${message}`);
	process.exit(1);
}
