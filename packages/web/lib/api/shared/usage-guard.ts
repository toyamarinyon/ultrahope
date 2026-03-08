import type { Db } from "@/db/client";
import type { DailyLimitExceededError } from "@/lib/util/daily-limit";
import {
	type BillingUnavailableBody,
	createBillingUnavailableBody,
	createDailyLimitExceededBody,
	createInputLengthExceededBody,
	createInsufficientBalanceBody,
	createSubscriptionRequiredBody,
	type DailyLimitExceededBody,
	type InputLengthExceededBody,
	type InsufficientBalanceBody,
	type SubscriptionRequiredBody,
} from "./errors";

const MOCKING = process.env.MOCKING === "1";
const SKIP_DAILY_LIMIT_CHECK =
	process.env.NODE_ENV !== "production" &&
	process.env.SKIP_DAILY_LIMIT_CHECK === "1";

export const FREE_INPUT_LENGTH_LIMIT = 40000;

function isMockingEnabled(): boolean {
	return MOCKING;
}

function isDailyLimitCheckBypassed(): boolean {
	return SKIP_DAILY_LIMIT_CHECK;
}

function logUsageBypass(reason: "MOCKING" | "SKIP_DAILY_LIMIT_CHECK") {
	if (reason === "MOCKING") {
		console.log("[MOCKING] Daily limit check bypassed");
	}
	if (reason === "SKIP_DAILY_LIMIT_CHECK") {
		console.log("[SKIP_DAILY_LIMIT_CHECK] Daily limit check bypassed");
	}
}

export function combineAbortSignals(
	primary: AbortSignal,
	secondary: AbortSignal,
): AbortSignal {
	if (primary.aborted) return primary;
	if (secondary.aborted) return secondary;

	const controller = new AbortController();
	const onAbort = (signal: AbortSignal) => {
		if (!controller.signal.aborted) {
			controller.abort(signal.reason);
		}
	};

	primary.addEventListener("abort", () => onAbort(primary), { once: true });
	secondary.addEventListener("abort", () => onAbort(secondary), { once: true });
	return controller.signal;
}

type BillingInfo = {
	plan?: "pro";
	balance?: number;
} | null;

type GetBillingInfo = (userId: number) => Promise<BillingInfo>;

export async function getBillingInfoOr503(args: {
	userId: number;
	isAnonymous: boolean;
	getUserBillingInfo: GetBillingInfo;
	baseUrl: string;
	set: { status?: number | string };
	generationAbortController?: AbortController;
}): Promise<
	| { status: 200; billingInfo: BillingInfo; plan: "anonymous" | "pro" }
	| { status: 402; errorBody: SubscriptionRequiredBody }
	| { status: 503; errorBody: BillingUnavailableBody }
> {
	if (args.isAnonymous) {
		return {
			status: 200,
			billingInfo: null,
			plan: "anonymous",
		};
	}

	try {
		const billingInfo = await args.getUserBillingInfo(args.userId);
		if (!billingInfo) {
			args.generationAbortController?.abort("subscription_required");
			args.set.status = 402;
			return {
				status: 402,
				errorBody: createSubscriptionRequiredBody(args.baseUrl),
			};
		}
		return {
			status: 200,
			billingInfo,
			plan: billingInfo.plan ?? "pro",
		};
	} catch (_error) {
		args.generationAbortController?.abort("billing_unavailable");
		args.set.status = 503;
		return {
			status: 503,
			errorBody: createBillingUnavailableBody(),
		};
	}
}

export async function enforceDailyLimitOr402(
	deps: {
		assertDailyLimitNotExceeded: (
			db: Db,
			installationId: string,
			options?: { excludeCliSessionId?: string },
		) => Promise<void>;
		baseUrl: string;
	},
	args: {
		db: Db;
		installationId: string;
		plan: "anonymous" | "pro";
		currentCliSessionId?: string;
		generationAbortController: AbortController;
		set: { status?: number | string };
	},
): Promise<null | { status: 402; errorBody: DailyLimitExceededBody }> {
	if (args.plan !== "anonymous") {
		return null;
	}

	if (isMockingEnabled()) {
		logUsageBypass("MOCKING");
		return null;
	}

	if (isDailyLimitCheckBypassed()) {
		logUsageBypass("SKIP_DAILY_LIMIT_CHECK");
		return null;
	}

	try {
		await deps.assertDailyLimitNotExceeded(args.db, args.installationId, {
			excludeCliSessionId: args.currentCliSessionId,
		});
		return null;
	} catch (error) {
		if (error instanceof Error && error.name === "DailyLimitExceededError") {
			args.generationAbortController.abort("daily_limit_exceeded");
			args.set.status = 402;
			return {
				status: 402,
				errorBody: createDailyLimitExceededBody(
					error as DailyLimitExceededError,
					deps.baseUrl,
				),
			};
		}
		throw error;
	}
}

export function enforceProBalanceOr402(
	deps: {
		baseUrl: string;
	},
	args: {
		plan: "anonymous" | "pro";
		billingInfo: BillingInfo;
		generationAbortController: AbortController;
		set: { status?: number | string };
	},
): null | { status: 402; errorBody: InsufficientBalanceBody } {
	if (args.plan !== "pro" || args.billingInfo?.balance == null) {
		return null;
	}

	if (args.billingInfo.balance > 0) {
		return null;
	}

	args.generationAbortController.abort("insufficient_balance");
	args.set.status = 402;
	return {
		status: 402,
		errorBody: createInsufficientBalanceBody(
			{
				balance: args.billingInfo.balance,
				plan: args.billingInfo.plan ?? "pro",
			},
			deps.baseUrl,
		),
	};
}

export function enforceInputLengthLimitOr400(args: {
	plan: "anonymous" | "pro";
	input: string;
	limit: number;
	set: { status?: number | string };
}): null | { status: 400; errorBody: InputLengthExceededBody } {
	if (args.plan !== "anonymous") {
		return null;
	}

	const count = args.input.length;
	if (count <= args.limit) {
		return null;
	}

	args.set.status = 400;
	return {
		status: 400,
		errorBody: createInputLengthExceededBody({
			count,
			limit: args.limit,
		}),
	};
}
