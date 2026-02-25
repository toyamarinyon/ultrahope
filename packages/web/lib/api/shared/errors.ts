import { ALLOWED_MODEL_IDS } from "@/lib/llm/models";
import type { DailyLimitExceededError } from "@/lib/util/daily-limit";
import type { InvalidModelBody } from "./validators";

type UnauthorizedBody = {
	error: string;
};

export type DailyLimitExceededBody = {
	error: "daily_limit_exceeded";
	message: string;
	count: number;
	limit: number;
	resetsAt: string;
	plan: "free";
	actions: {
		upgrade: string;
	};
	hint: string;
};

export type InsufficientBalanceBody = {
	error: "insufficient_balance";
	message: string;
	balance: number;
	plan: "free" | "pro";
	actions: {
		buyCredits: string;
	};
	hint: string;
};

export type BillingUnavailableBody = {
	error: "billing_unavailable";
	message: string;
};

export type InputLengthExceededBody = {
	error: "input_too_long";
	message: string;
	count: number;
	limit: number;
	plan: "free";
};

export const unauthorizedBody: UnauthorizedBody = {
	error: "Unauthorized",
};

export function invalidModelErrorBody(model: string): InvalidModelBody {
	return {
		error: "invalid_model",
		message: `Model '${model}' is not supported.`,
		allowedModels: ALLOWED_MODEL_IDS,
	};
}

export function createDailyLimitExceededBody(
	error: DailyLimitExceededError,
	baseUrl: string,
	hint = "Upgrade to Pro for unlimited requests with $5 included credit.",
): DailyLimitExceededBody {
	return {
		error: "daily_limit_exceeded",
		message: "Daily request limit reached.",
		count: error.count,
		limit: error.limit,
		resetsAt: error.resetsAt.toISOString(),
		plan: "free",
		actions: {
			upgrade: `${baseUrl}/pricing`,
		},
		hint,
	};
}

export function createInsufficientBalanceBody(
	params: {
		balance: number;
		plan: "free" | "pro";
	},
	baseUrl: string,
	hint = "Purchase additional credits to continue.",
): InsufficientBalanceBody {
	return {
		error: "insufficient_balance",
		message: "Your usage credit has been exhausted.",
		balance: params.balance,
		plan: params.plan,
		actions: {
			buyCredits: `${baseUrl}/settings/billing#credits`,
		},
		hint,
	};
}

export function createBillingUnavailableBody(): BillingUnavailableBody {
	return {
		error: "billing_unavailable",
		message: "Unable to verify billing info.",
	};
}

export function createInputLengthExceededBody(params: {
	count: number;
	limit: number;
}): InputLengthExceededBody {
	return {
		error: "input_too_long",
		message: `Input exceeds ${params.limit} characters.`,
		count: params.count,
		limit: params.limit,
		plan: "free",
	};
}

export function formatVerboseError(
	error: unknown,
): Record<string, unknown> | unknown {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}
	return error;
}
