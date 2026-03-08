import { describe, expect, it } from "bun:test";
import { DailyLimitExceededError } from "@/lib/util/daily-limit";
import {
	enforceDailyLimitOr402,
	enforceInputLengthLimitOr400,
	enforceProBalanceOr402,
	FREE_INPUT_LENGTH_LIMIT,
	getBillingInfoOr503,
} from "./usage-guard";

describe("usage-guard", () => {
	it("returns billing info when available", async () => {
		const result = await getBillingInfoOr503({
			userId: 42,
			isAnonymous: false,
			getUserBillingInfo: async () => ({
				plan: "pro",
				balance: 10,
				meterId: "m",
			}),
			baseUrl: "https://example.com",
			set: {},
			generationAbortController: new AbortController(),
		});
		expect(result.status).toBe(200);
		if (result.status !== 200) {
			throw new Error("unexpected 503");
		}
		expect(result.billingInfo?.balance).toBe(10);
	});

	it("returns billing-unavailable response when billing lookup fails", async () => {
		const result = await getBillingInfoOr503({
			userId: 42,
			isAnonymous: false,
			getUserBillingInfo: async () => {
				throw new Error("downstream");
			},
			baseUrl: "https://example.com",
			set: {},
			generationAbortController: new AbortController(),
		});

		expect(result.status).toBe(503);
		if (result.status !== 503) {
			throw new Error("unexpected status");
		}
		expect(result.errorBody.error).toBe("billing_unavailable");
		expect(result.errorBody.message).toContain("Unable to verify billing info");
	});

	it("returns subscription-required response for authenticated unpaid users", async () => {
		const result = await getBillingInfoOr503({
			userId: 42,
			isAnonymous: false,
			getUserBillingInfo: async () => null,
			baseUrl: "https://example.com",
			set: {},
			generationAbortController: new AbortController(),
		});

		expect(result.status).toBe(402);
		if (result.status !== 402) {
			throw new Error("unexpected status");
		}
		expect(result.errorBody.error).toBe("subscription_required");
		expect(result.errorBody.actions.subscribe).toBe(
			"https://example.com/checkout/start",
		);
	});

	it("returns daily limit response for anonymous users when limit reached", async () => {
		const limitError = new DailyLimitExceededError(
			5,
			5,
			new Date("2026-01-01T00:00:00.000Z"),
		);

		const result = await enforceDailyLimitOr402(
			{
				assertDailyLimitNotExceeded: async () => {
					throw limitError;
				},
				baseUrl: "https://example.com",
			},
			{
				db: null as unknown as never,
				installationId: "installation-1",
				plan: "anonymous",
				generationAbortController: new AbortController(),
				set: {},
			},
		);

		expect(result?.status).toBe(402);
		if (result?.status !== 402) {
			throw new Error("unexpected non-402");
		}
		expect(result?.errorBody.error).toBe("daily_limit_exceeded");
		expect(result?.errorBody.limit).toBe(5);
		expect(result?.errorBody.actions?.upgrade).toBe(
			"https://example.com/pricing",
		);
	});

	it("returns insufficient balance for pro users with zero balance", async () => {
		const result = enforceProBalanceOr402(
			{
				baseUrl: "https://example.com",
			},
			{
				plan: "pro",
				billingInfo: { plan: "pro", balance: 0 },
				generationAbortController: new AbortController(),
				set: {},
			},
		);

		expect(result?.status).toBe(402);
		if (result?.status !== 402) {
			throw new Error("unexpected non-402");
		}
		expect(result?.errorBody.error).toBe("insufficient_balance");
		expect(result?.errorBody.balance).toBe(0);
		expect(result?.errorBody.actions.buyCredits).toBe(
			"https://example.com/settings/billing#credits",
		);
	});

	it("does not enforce balance check when plan is anonymous", () => {
		expect(
			enforceProBalanceOr402(
				{
					baseUrl: "https://example.com",
				},
				{
					plan: "anonymous",
					billingInfo: null,
					generationAbortController: new AbortController(),
					set: {},
				},
			),
		).toBeNull();
	});

	it("does not enforce input length when input is within anonymous plan limit", () => {
		expect(
			enforceInputLengthLimitOr400({
				plan: "anonymous",
				input: "a".repeat(FREE_INPUT_LENGTH_LIMIT),
				limit: FREE_INPUT_LENGTH_LIMIT,
				set: {},
			}),
		).toBeNull();
	});

	it("returns input length exceeded error for anonymous plan when input exceeds limit", () => {
		const result = enforceInputLengthLimitOr400({
			plan: "anonymous",
			input: "a".repeat(FREE_INPUT_LENGTH_LIMIT + 1),
			limit: FREE_INPUT_LENGTH_LIMIT,
			set: {},
		});

		expect(result?.status).toBe(400);
		if (result?.status !== 400) {
			throw new Error("unexpected non-400");
		}
		expect(result?.errorBody.error).toBe("input_too_long");
		expect(result?.errorBody.count).toBe(FREE_INPUT_LENGTH_LIMIT + 1);
		expect(result?.errorBody.limit).toBe(FREE_INPUT_LENGTH_LIMIT);
	});

	it("does not enforce input length for pro plans", () => {
		expect(
			enforceInputLengthLimitOr400({
				plan: "pro",
				input: "a".repeat(FREE_INPUT_LENGTH_LIMIT + 1),
				limit: FREE_INPUT_LENGTH_LIMIT,
				set: {},
			}),
		).toBeNull();
	});
});
