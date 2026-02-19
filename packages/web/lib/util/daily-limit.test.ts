import { describe, expect, it } from "bun:test";
import {
	assertDailyLimitNotExceeded,
	DailyLimitExceededError,
	getDailyUsageInfo,
} from "./daily-limit";

function createDb(count: number, resetAt?: Date): unknown {
	const countResult = Object.assign(
		[
			{
				count,
			},
		],
		{
			orderBy: () => ({
				limit: () => (resetAt ? [{ startedAt: resetAt }] : []),
			}),
		},
	);

	const resetResult = Object.assign(resetAt ? [{ startedAt: resetAt }] : [], {
		orderBy: () => ({
			limit: () => (resetAt ? [{ startedAt: resetAt }] : []),
		}),
	}) as Array<{ startedAt: Date }>;

	let callCount = 0;

	return {
		select: () => ({
			from: () => ({
				where: () => {
					callCount += 1;
					return callCount === 1 ? countResult : resetResult;
				},
			}),
		}),
	};
}

describe("daily-limit", () => {
	it("throws when usage exceeds quota", async () => {
		await expect(
			assertDailyLimitNotExceeded(createDb(5) as never, 1),
		).rejects.toThrow(DailyLimitExceededError);
	});

	it("allows requests below quota", async () => {
		await expect(
			assertDailyLimitNotExceeded(createDb(3) as never, 1),
		).resolves.toBeUndefined();
	});

	it("returns remaining usage stats for user", async () => {
		const resetsAt = new Date("2026-02-01T00:00:00.000Z");
		const usage = await getDailyUsageInfo(createDb(3, resetsAt) as never, 1);

		expect(usage.limit).toBe(5);
		expect(usage.remaining).toBe(2);
		expect(usage.resetsAt).toEqual(new Date("2026-02-02T00:00:00.000Z"));
	});
});
