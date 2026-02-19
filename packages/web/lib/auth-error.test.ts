import { describe, expect, it } from "bun:test";
import {
	isLikelyInvalidEmailDomain,
	mapAuthClientError,
	shouldTreatForgotPasswordRequestAsSuccess,
} from "./auth/auth-error";

describe("isLikelyInvalidEmailDomain", () => {
	it("accepts a valid email domain", () => {
		expect(isLikelyInvalidEmailDomain("user@example.com")).toBe(false);
	});

	it("rejects localhost domain", () => {
		expect(isLikelyInvalidEmailDomain("user@localhost")).toBe(true);
	});

	it("rejects domain without dot", () => {
		expect(isLikelyInvalidEmailDomain("user@example")).toBe(true);
	});

	it("rejects missing domain", () => {
		expect(isLikelyInvalidEmailDomain("user@")).toBe(true);
	});
});

describe("mapAuthClientError", () => {
	it("maps invalid email/password to user message", () => {
		const result = mapAuthClientError(
			{ message: "INVALID_EMAIL_OR_PASSWORD" },
			"login",
		);
		expect(result.userMessage).toBe("Invalid email or password.");
	});

	it("maps plain invalid email/password phrase to user message", () => {
		const result = mapAuthClientError(
			{ message: "Invalid email or password" },
			"login",
		);
		expect(result.userMessage).toBe("Invalid email or password.");
	});

	it("maps URL_INVALID to retry message", () => {
		const result = mapAuthClientError(
			{ message: "URL_INVALID" },
			"forgot-password",
		);
		expect(result.userMessage).toBe(
			"Failed to process the request. Please try again later.",
		);
	});

	it("does not surface raw JSON messages", () => {
		const result = mapAuthClientError(
			{
				message:
					'{"code":"BAD_REQUEST","message":"zod validation failed","issues":[{"path":["email"],"message":"invalid"}]}',
			},
			"signup",
		);
		expect(result.userMessage).toBe(
			"Authentication failed. Please try again later.",
		);
	});

	it("falls back to generic message for unknown errors", () => {
		const result = mapAuthClientError(
			{ message: "unexpected failure" },
			"signup",
		);
		expect(result.userMessage).toBe(
			"Authentication failed. Please try again later.",
		);
	});

	it("maps invalid token to reset-link message", () => {
		const result = mapAuthClientError(
			{ message: "INVALID_TOKEN" },
			"reset-password",
		);
		expect(result.userMessage).toBe("The link is invalid or has expired.");
	});
});

describe("shouldTreatForgotPasswordRequestAsSuccess", () => {
	it("returns false when auth API responds with error", () => {
		expect(
			shouldTreatForgotPasswordRequestAsSuccess({
				error: { message: "URL_INVALID" },
			}),
		).toBe(false);
	});
});
