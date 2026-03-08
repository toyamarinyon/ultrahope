import { describe, expect, it } from "bun:test";
import {
	AnonymousTrialExceededError,
	DailyLimitExceededError,
} from "@/lib/util/daily-limit";
import {
	createAnonymousTrialExceededBody,
	createDailyLimitExceededBody,
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

	it("returns login action for anonymous trial exhaustion", () => {
		const body = createAnonymousTrialExceededBody(
			new AnonymousTrialExceededError(5, 5),
			"https://example.com",
		);

		expect(body.error).toBe("anonymous_trial_exceeded");
		expect(body.actions.login).toBe("https://example.com/login");
		expect(body.hint).toContain("ultrahope login");
	});
});
