import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { freePlanDailyUsage } from "@/db/schema";

const FREE_DAILY_LIMIT = 5;

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

function getUTCDateString(): string {
	return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function getNextResetTime(): Date {
	const now = new Date();
	const tomorrow = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
	);
	return tomorrow;
}

async function getDailyUsage(userId: string): Promise<number> {
	const date = getUTCDateString();
	const result = await db
		.select({ count: freePlanDailyUsage.count })
		.from(freePlanDailyUsage)
		.where(
			and(
				eq(freePlanDailyUsage.userId, userId),
				eq(freePlanDailyUsage.date, date),
			),
		)
		.limit(1);

	return result[0]?.count ?? 0;
}

export async function assertDailyLimitNotExceeded(
	userId: string,
): Promise<void> {
	const count = await getDailyUsage(userId);
	if (count >= FREE_DAILY_LIMIT) {
		throw new DailyLimitExceededError(
			count,
			FREE_DAILY_LIMIT,
			getNextResetTime(),
		);
	}
}

export async function incrementDailyUsage(userId: string): Promise<number> {
	const date = getUTCDateString();

	await db
		.insert(freePlanDailyUsage)
		.values({ userId, date, count: 1 })
		.onConflictDoUpdate({
			target: [freePlanDailyUsage.userId, freePlanDailyUsage.date],
			set: { count: sql`${freePlanDailyUsage.count} + 1` },
		});

	return await getDailyUsage(userId);
}
