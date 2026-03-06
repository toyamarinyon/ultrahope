import { describe, expect, it } from "bun:test";
import { DailyLimitExceededError } from "@/lib/util/daily-limit";
import { createDailyLimitExceededBody } from "./errors";

describe("errors", () => {
	it("uses the updated Pro upgrade hint", () => {
		const body = createDailyLimitExceededBody(
			new DailyLimitExceededError(5, 5, new Date("2026-03-06T00:00:00.000Z")),
			"https://example.com",
		);

		expect(body.hint).toContain("$1 included credit");
		expect(body.hint).not.toContain("$5 included credit");
	});
});
