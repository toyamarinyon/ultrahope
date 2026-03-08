import { afterEach, describe, expect, it, mock } from "bun:test";
import {
	createApiClient,
	InsufficientBalanceError,
	SubscriptionRequiredError,
} from "./api-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("InsufficientBalanceError", () => {
	it("formats the anonymous upgrade message with the updated included credit", () => {
		const error = new InsufficientBalanceError(0, "anonymous");

		expect(error.formatMessage()).toContain("$1 included credit");
		expect(error.formatMessage()).not.toContain("$5 included credit");
	});
});

describe("SubscriptionRequiredError", () => {
	it("formats the subscription-required message with checkout URL", () => {
		const error = new SubscriptionRequiredError(
			"https://example.com/checkout/start",
			"Complete checkout to continue.",
		);

		expect(error.formatMessage()).toContain("active Pro subscription");
		expect(error.formatMessage()).toContain(
			"https://example.com/checkout/start",
		);
	});
});

describe("createApiClient", () => {
	it("sends an empty json body for anonymous sign-in", async () => {
		const fetchMock = mock(
			async (_input: string | URL | Request, _init?: RequestInit) =>
				new Response(JSON.stringify({ token: "token" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = createApiClient();
		await client.signInAnonymous();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[1]?.body).toBe("{}");
		expect(
			(
				fetchMock.mock.calls[0]?.[1]?.headers as
					| Record<string, string>
					| undefined
			)?.["Content-Type"],
		).toBe("application/json");
	});

	it("sends an empty json body for anonymous delete", async () => {
		const fetchMock = mock(
			async (_input: string | URL | Request, _init?: RequestInit) =>
				new Response(null, {
					status: 200,
				}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = createApiClient();
		await client.deleteAnonymousUser();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[1]?.body).toBe("{}");
		expect(
			(
				fetchMock.mock.calls[0]?.[1]?.headers as
					| Record<string, string>
					| undefined
			)?.["Content-Type"],
		).toBe("application/json");
	});

	it("keeps json content type for handwritten json requests", async () => {
		const fetchMock = mock(
			async (_input: string | URL | Request, _init?: RequestInit) =>
				new Response(JSON.stringify({ token: "token" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const client = createApiClient();
		await client.requestDeviceCode();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(
			(
				fetchMock.mock.calls[0]?.[1]?.headers as
					| Record<string, string>
					| undefined
			)?.["Content-Type"],
		).toBe("application/json");
	});
});
