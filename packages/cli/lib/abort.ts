import { DailyLimitExceededError, UnauthorizedError } from "./api-client";

export type CommandAbortReason =
	| "daily_limit"
	| "unauthorized"
	| "user"
	| "internal";

export function mergeAbortSignals(
	...signals: Array<AbortSignal | undefined>
): AbortSignal | undefined {
	const validSignals = signals.filter(
		(signal): signal is AbortSignal => signal !== undefined,
	);

	if (validSignals.length === 0) return undefined;
	if (validSignals.length === 1) return validSignals[0];

	const controller = new AbortController();

	for (const signal of validSignals) {
		if (signal.aborted) {
			controller.abort(signal.reason);
			break;
		}
		signal.addEventListener(
			"abort",
			() => {
				controller.abort(signal.reason);
			},
			{ once: true },
		);
	}

	return controller.signal;
}

function commandAbortReason(
	signal?: AbortSignal,
): CommandAbortReason | undefined {
	if (!signal?.aborted) return undefined;
	const reason = signal.reason;
	if (reason === "daily_limit" || reason === "unauthorized") {
		return reason;
	}
	if (reason === "user" || reason === "internal") {
		return reason;
	}
	if (reason instanceof DailyLimitExceededError) return "daily_limit";
	if (reason instanceof UnauthorizedError) return "unauthorized";
	return "internal";
}

export function isCommandExecutionAbort(signal?: AbortSignal): boolean {
	const reason = commandAbortReason(signal);
	return reason === "daily_limit" || reason === "unauthorized";
}

export function abortReasonForError(error: unknown): CommandAbortReason {
	if (error instanceof DailyLimitExceededError) return "daily_limit";
	if (error instanceof UnauthorizedError) return "unauthorized";
	return "internal";
}
