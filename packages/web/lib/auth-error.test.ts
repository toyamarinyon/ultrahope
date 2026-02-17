import { describe, expect, it } from "bun:test";
import {
	isLikelyInvalidEmailDomain,
	mapAuthClientError,
	shouldTreatForgotPasswordRequestAsSuccess,
} from "./auth-error";

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
		expect(result.userMessage).toBe(
			"メールアドレスまたはパスワードが正しくありません。",
		);
	});

	it("maps plain invalid email/password phrase to user message", () => {
		const result = mapAuthClientError(
			{ message: "Invalid email or password" },
			"login",
		);
		expect(result.userMessage).toBe(
			"メールアドレスまたはパスワードが正しくありません。",
		);
	});

	it("maps URL_INVALID to retry message", () => {
		const result = mapAuthClientError(
			{ message: "URL_INVALID" },
			"forgot-password",
		);
		expect(result.userMessage).toBe(
			"リクエストの処理に失敗しました。時間をおいて再試行してください。",
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
			"認証に失敗しました。時間をおいてもう一度お試しください。",
		);
	});

	it("falls back to generic message for unknown errors", () => {
		const result = mapAuthClientError(
			{ message: "unexpected failure" },
			"signup",
		);
		expect(result.userMessage).toBe(
			"認証に失敗しました。時間をおいてもう一度お試しください。",
		);
	});

	it("maps invalid token to reset-link message", () => {
		const result = mapAuthClientError(
			{ message: "INVALID_TOKEN" },
			"reset-password",
		);
		expect(result.userMessage).toBe("リンクが無効または期限切れです。");
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
