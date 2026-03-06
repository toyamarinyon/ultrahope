import { describe, expect, it } from "bun:test";
import { InsufficientBalanceError } from "./api-client";

describe("InsufficientBalanceError", () => {
	it("formats the free-plan upgrade message with the updated included credit", () => {
		const error = new InsufficientBalanceError(0, "free");

		expect(error.formatMessage()).toContain("$1 included credit");
		expect(error.formatMessage()).not.toContain("$5 included credit");
	});
});
