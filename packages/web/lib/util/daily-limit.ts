import { and, asc, eq, gte, ne, sql } from "drizzle-orm";
import { commandExecution } from "@/db";
import type { Db } from "@/db/client";

const FREE_DAILY_LIMIT = 5;
const ANONYMOUS_TRIAL_LIMIT = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export class DailyLimitExceededError extends Error {
	constructor(
		public count: number,
		public limit: number,
		public resetsAt: Date,
	) {
		super(`Daily limit exceeded: ${count}/${limit}`);
		this.name = "DailyLimitExceededError";
	}
}

export class AnonymousTrialExceededError extends Error {
	constructor(
		public count: number,
		public limit: number,
	) {
		super(`Anonymous trial exceeded: ${count}/${limit}`);
		this.name = "AnonymousTrialExceededError";
	}
}

function createUsageWhere(args: {
	userId: number;
	sinceMs?: number;
	excludeCliSessionId?: string;
}) {
	const userClause = eq(commandExecution.userId, args.userId);

	if (typeof args.sinceMs === "number" && args.excludeCliSessionId) {
		return and(
			userClause,
			gte(commandExecution.startedAt, new Date(args.sinceMs)),
			ne(commandExecution.cliSessionId, args.excludeCliSessionId),
		);
	}

	if (typeof args.sinceMs === "number") {
		return and(
			userClause,
			gte(commandExecution.startedAt, new Date(args.sinceMs)),
		);
	}

	if (args.excludeCliSessionId) {
		return and(
			userClause,
			ne(commandExecution.cliSessionId, args.excludeCliSessionId),
		);
	}

	return userClause;
}

async function getUsageCount(
	db: Db,
	userId: number,
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
				userId,
				sinceMs: options?.sinceMs,
				excludeCliSessionId: options?.excludeCliSessionId,
			}),
		);

	return result[0]?.count ?? 0;
}

async function getResetTime(
	db: Db,
	userId: number,
	sinceMs: number,
	excludeCliSessionId?: string,
): Promise<Date> {
	const oldest = await db
		.select({ startedAt: commandExecution.startedAt })
		.from(commandExecution)
		.where(
			createUsageWhere({
				userId,
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
	userId: number,
	options?: { excludeCliSessionId?: string },
): Promise<void> {
	const sinceMs = Date.now() - WINDOW_MS;
	const count = await getUsageCount(db, userId, {
		sinceMs,
		excludeCliSessionId: options?.excludeCliSessionId,
	});
	if (count >= FREE_DAILY_LIMIT) {
		throw new DailyLimitExceededError(
			count,
			FREE_DAILY_LIMIT,
			await getResetTime(db, userId, sinceMs, options?.excludeCliSessionId),
		);
	}
}

export async function assertAnonymousTrialNotExceeded(
	db: Db,
	userId: number,
	options?: { excludeCliSessionId?: string },
): Promise<void> {
	const count = await getUsageCount(db, userId, {
		excludeCliSessionId: options?.excludeCliSessionId,
	});
	if (count >= ANONYMOUS_TRIAL_LIMIT) {
		throw new AnonymousTrialExceededError(count, ANONYMOUS_TRIAL_LIMIT);
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
	userId: number,
): Promise<DailyUsageInfo> {
	const sinceMs = Date.now() - WINDOW_MS;
	const count = await getUsageCount(db, userId, { sinceMs });
	const resetsAt = await getResetTime(db, userId, sinceMs);
	return {
		count,
		limit: FREE_DAILY_LIMIT,
		remaining: Math.max(0, FREE_DAILY_LIMIT - count),
		resetsAt,
	};
}
