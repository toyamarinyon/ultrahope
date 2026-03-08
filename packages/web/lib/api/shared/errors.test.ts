import { describe, expect, it } from "bun:test";
import { DailyLimitExceededError } from "@/lib/util/daily-limit";
import {
	createDailyLimitExceededBody,
	createSubscriptionRequiredBody,
} from "./errors";

describe("errors", () => {
	it("uses the updated Pro upgrade hint", () => {
		const body = createDailyLimitExceededBody(
			new DailyLimitExceededError(5, 5, new Date("2026-03-06T00:00:00.000Z")),
			"https://example.com",
		);

		expect(body.hint).toContain("$1 included credit");
		expect(body.hint).not.toContain("$5 included credit");
	});

	it("returns anonymous plan in the daily limit payload", () => {
		const body = createDailyLimitExceededBody(
			new DailyLimitExceededError(5, 5, new Date("2026-03-06T00:00:00.000Z")),
			"https://example.com",
		);

		expect(body.error).toBe("daily_limit_exceeded");
		expect(body.plan).toBe("anonymous");
		expect(body.actions.upgrade).toBe("https://example.com/pricing");
	});

	it("returns checkout action for subscription-required payload", () => {
		const body = createSubscriptionRequiredBody("https://example.com");

		expect(body.error).toBe("subscription_required");
		expect(body.plan).toBe("authenticated_unpaid");
		expect(body.actions.subscribe).toBe("https://example.com/checkout/start");
	});
});
