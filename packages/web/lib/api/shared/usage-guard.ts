import type { Db } from "@/db/client";
import type { DailyLimitExceededError } from "@/lib/util/daily-limit";
import {
	type BillingUnavailableBody,
	createBillingUnavailableBody,
	createDailyLimitExceededBody,
	createInsufficientBalanceBody,
	type DailyLimitExceededBody,
	type InsufficientBalanceBody,
} from "./errors";

export const MOCKING = process.env.MOCKING === "1";
export const SKIP_DAILY_LIMIT_CHECK =
	process.env.NODE_ENV !== "production" &&
	process.env.SKIP_DAILY_LIMIT_CHECK === "1";

export function isMockingEnabled(): boolean {
	return MOCKING;
}

export function isDailyLimitCheckBypassed(): boolean {
	return SKIP_DAILY_LIMIT_CHECK;
}

export function logUsageBypass(reason: "MOCKING" | "SKIP_DAILY_LIMIT_CHECK") {
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
	plan?: "free" | "pro";
	balance?: number;
} | null;

type GetBillingInfo = (userId: number) => Promise<BillingInfo>;

export async function getBillingInfoOr503(args: {
	userId: number;
	getUserBillingInfo: GetBillingInfo;
	set: { status?: number | string };
	generationAbortController: AbortController;
}): Promise<
	| { status: 200; billingInfo: BillingInfo; plan: "free" | "pro" }
	| { status: 503; errorBody: BillingUnavailableBody }
> {
	try {
		const billingInfo = await args.getUserBillingInfo(args.userId);
		return {
			status: 200,
			billingInfo,
			plan: billingInfo?.plan ?? "free",
		};
	} catch (_error) {
		args.generationAbortController.abort("billing_unavailable");
		args.set.status = 503;
		return {
			status: 503,
			errorBody: createBillingUnavailableBody(),
		};
	}
}

export async function enforceDailyLimitOr402(
	deps: {
		assertDailyLimitNotExceeded: (db: Db, userId: number) => Promise<void>;
		baseUrl: string;
	},
	args: {
		db: Db;
		userId: number;
		plan: "free" | "pro";
		generationAbortController: AbortController;
		set: { status?: number | string };
	},
): Promise<null | { status: 402; errorBody: DailyLimitExceededBody }> {
	if (args.plan !== "free") {
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
		await deps.assertDailyLimitNotExceeded(args.db, args.userId);
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
		plan: "free" | "pro";
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
