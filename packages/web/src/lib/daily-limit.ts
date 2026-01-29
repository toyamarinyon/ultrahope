import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { commandExecution } from "@/db/schema";

const FREE_DAILY_LIMIT = 5;
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

async function getUsageCount(userId: string, sinceMs: number): Promise<number> {
	const result = await db
		.select({ count: sql<number>`count(*)` })
		.from(commandExecution)
		.where(
			and(
				eq(commandExecution.userId, userId),
				gte(commandExecution.startedAt, new Date(sinceMs)),
			),
		);

	return result[0]?.count ?? 0;
}

async function getResetTime(userId: string, sinceMs: number): Promise<Date> {
	const oldest = await db
		.select({ startedAt: commandExecution.startedAt })
		.from(commandExecution)
		.where(
			and(
				eq(commandExecution.userId, userId),
				gte(commandExecution.startedAt, new Date(sinceMs)),
			),
		)
		.orderBy(asc(commandExecution.startedAt))
		.limit(1);

	if (!oldest[0]) {
		return new Date(Date.now() + WINDOW_MS);
	}

	return new Date(oldest[0].startedAt.getTime() + WINDOW_MS);
}

export async function assertDailyLimitNotExceeded(
	userId: string,
): Promise<void> {
	const sinceMs = Date.now() - WINDOW_MS;
	const count = await getUsageCount(userId, sinceMs);
	if (count >= FREE_DAILY_LIMIT) {
		throw new DailyLimitExceededError(
			count,
			FREE_DAILY_LIMIT,
			await getResetTime(userId, sinceMs),
		);
	}
}
