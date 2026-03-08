import { and, asc, eq, gte, ne, sql } from "drizzle-orm";
import { commandExecution } from "@/db";
import type { Db } from "@/db/client";

const ANONYMOUS_DAILY_LIMIT = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export class DailyLimitExceededError extends Error {
	constructor(
		public count: number,
		public limit: number,
		public resetsAt: Date,
		public plan: "anonymous" = "anonymous",
	) {
		super(`Daily limit exceeded: ${count}/${limit}`);
		this.name = "DailyLimitExceededError";
	}
}

function createUsageWhere(args: {
	installationId: string;
	sinceMs?: number;
	excludeCliSessionId?: string;
}) {
	const installationClause = eq(
		commandExecution.installationId,
		args.installationId,
	);

	if (typeof args.sinceMs === "number" && args.excludeCliSessionId) {
		return and(
			installationClause,
			gte(commandExecution.startedAt, new Date(args.sinceMs)),
			ne(commandExecution.cliSessionId, args.excludeCliSessionId),
		);
	}

	if (typeof args.sinceMs === "number") {
		return and(
			installationClause,
			gte(commandExecution.startedAt, new Date(args.sinceMs)),
		);
	}

	if (args.excludeCliSessionId) {
		return and(
			installationClause,
			ne(commandExecution.cliSessionId, args.excludeCliSessionId),
		);
	}

	return installationClause;
}

async function getUsageCount(
	db: Db,
	installationId: string,
	options?: {
		sinceMs?: number;
		excludeCliSessionId?: string;
	},
): Promise<number> {
	const result = await db
		.select({ count: sql<number>`count(*)` })
		.from(commandExecution)
		.where(
			createUsageWhere({
				installationId,
				sinceMs: options?.sinceMs,
				excludeCliSessionId: options?.excludeCliSessionId,
			}),
		);

	return result[0]?.count ?? 0;
}

async function getResetTime(
	db: Db,
	installationId: string,
	sinceMs: number,
	excludeCliSessionId?: string,
): Promise<Date> {
	const oldest = await db
		.select({ startedAt: commandExecution.startedAt })
		.from(commandExecution)
		.where(
			createUsageWhere({
				installationId,
				sinceMs,
				excludeCliSessionId,
			}),
		)
		.orderBy(asc(commandExecution.startedAt))
		.limit(1);

	if (!oldest[0]) {
		return new Date(Date.now() + WINDOW_MS);
	}

	return new Date(oldest[0].startedAt.getTime() + WINDOW_MS);
}

export async function assertDailyLimitNotExceeded(
	db: Db,
	installationId: string,
	options?: { excludeCliSessionId?: string },
): Promise<void> {
	const sinceMs = Date.now() - WINDOW_MS;
	const count = await getUsageCount(db, installationId, {
		sinceMs,
		excludeCliSessionId: options?.excludeCliSessionId,
	});
	if (count >= ANONYMOUS_DAILY_LIMIT) {
		throw new DailyLimitExceededError(
			count,
			ANONYMOUS_DAILY_LIMIT,
			await getResetTime(
				db,
				installationId,
				sinceMs,
				options?.excludeCliSessionId,
			),
			"anonymous",
		);
	}
}

export interface DailyUsageInfo {
	count: number;
	limit: number;
	remaining: number;
	resetsAt: Date;
}

export async function getDailyUsageInfo(
	db: Db,
	installationId: string,
): Promise<DailyUsageInfo> {
	const sinceMs = Date.now() - WINDOW_MS;
	const count = await getUsageCount(db, installationId, { sinceMs });
	const resetsAt = await getResetTime(db, installationId, sinceMs);
	return {
		count,
		limit: ANONYMOUS_DAILY_LIMIT,
		remaining: Math.max(0, ANONYMOUS_DAILY_LIMIT - count),
		resetsAt,
	};
}
