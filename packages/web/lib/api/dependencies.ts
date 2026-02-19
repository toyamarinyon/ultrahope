import { readFileSync } from "node:fs";
import { getDb } from "@/db";
import type { Db } from "@/db/client";
import { getAuth, getPolarClient } from "@/lib/auth/auth";
import { MICRODOLLARS_PER_USD } from "@/lib/billing/auto-recharge";
import {
	generateCommitMessage,
	generateCommitMessageStream,
	generatePrIntent,
	generatePrTitleBody,
	getUserBillingInfo,
} from "@/lib/llm";
import { baseUrl } from "@/lib/util/base-url";
import {
	assertDailyLimitNotExceeded,
	getDailyUsageInfo,
} from "@/lib/util/daily-limit";
import {
	createBillingUnavailableBody,
	createDailyLimitExceededBody,
	createInsufficientBalanceBody,
} from "./shared/errors";
import { type ApiStorage, createDefaultApiStorage } from "./shared/storage";

export type ApiDependencies = {
	getAuth: () => ReturnType<typeof getAuth>;
	getDb: () => Db;
	getPolarClient: () => ReturnType<typeof getPolarClient>;
	getUserBillingInfo: typeof getUserBillingInfo;
	assertDailyLimitNotExceeded: typeof assertDailyLimitNotExceeded;
	getDailyUsageInfo: typeof getDailyUsageInfo;
	generateCommitMessage: typeof generateCommitMessage;
	generateCommitMessageStream: typeof generateCommitMessageStream;
	generatePrTitleBody: typeof generatePrTitleBody;
	generatePrIntent: typeof generatePrIntent;
	storage: ApiStorage;
	baseUrl: string;
	microDollarsPerUsd: number;
	createBillingUnavailableBody: () => ReturnType<
		typeof createBillingUnavailableBody
	>;
	createDailyLimitExceededBody: (
		...args: Parameters<typeof createDailyLimitExceededBody>
	) => ReturnType<typeof createDailyLimitExceededBody>;
	createInsufficientBalanceBody: (
		...args: Parameters<typeof createInsufficientBalanceBody>
	) => ReturnType<typeof createInsufficientBalanceBody>;
	getPackageVersion: () => string;
};

function readPackageVersion(): string {
	const fallback = "0.0.0";
	try {
		const packageJsonPath = new URL("../../package.json", import.meta.url);
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
			version?: string;
		};
		return packageJson.version ?? fallback;
	} catch {
		return fallback;
	}
}

export function createDefaultApiDependencies(): ApiDependencies {
	return {
		getAuth,
		getDb,
		getPolarClient,
		getUserBillingInfo,
		assertDailyLimitNotExceeded,
		getDailyUsageInfo,
		generateCommitMessage,
		generateCommitMessageStream,
		generatePrIntent,
		generatePrTitleBody,
		storage: createDefaultApiStorage(),
		baseUrl,
		microDollarsPerUsd: MICRODOLLARS_PER_USD,
		createBillingUnavailableBody,
		createDailyLimitExceededBody,
		createInsufficientBalanceBody,
		getPackageVersion: readPackageVersion,
	};
}
