import { readFileSync } from "node:fs";
import { openapi } from "@elysiajs/openapi";
import { Elysia, t } from "elysia";
import { auth } from "@/lib/auth";
import {
	DailyLimitExceededError,
	InsufficientBalanceError,
	translate,
} from "@/lib/llm";

const packageJson = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version?: string };

export const app = new Elysia({ prefix: "/api" })
	.use(
		openapi({
			path: "/openapi",
			specPath: "/openapi/json",
			documentation: {
				info: {
					title: "Ultrahope API",
					version: packageJson.version ?? "0.0.0",
				},
				components: {
					securitySchemes: {
						bearerAuth: {
							type: "http",
							scheme: "bearer",
						},
					},
				},
			},
		}),
	)
	.derive(async ({ request: { headers } }) => {
		const session = await auth.api.getSession({ headers });
		return { session };
	})
	.post(
		"/v1/translate",
		async ({ body, session, set }) => {
			if (!session) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			const validTargets = ["vcs-commit-message", "pr-title-body", "pr-intent"];
			if (!validTargets.includes(body.target)) {
				set.status = 400;
				return { error: `Invalid target: ${body.target}` };
			}

			try {
				const response = await translate(
					body.input,
					body.target as "vcs-commit-message" | "pr-title-body" | "pr-intent",
					{
						externalCustomerId: session.user.id,
						model: body.model,
					},
				);
				return { output: response.content, ...response };
			} catch (error) {
				if (error instanceof DailyLimitExceededError) {
					set.status = 402;
					return {
						error: "daily_limit_exceeded" as const,
						message: "Daily request limit reached.",
						count: error.count,
						limit: error.limit,
						resetsAt: error.resetsAt.toISOString(),
						plan: "free" as const,
						actions: {
							upgrade: "https://ultrahope.dev/pricing",
						},
						hint: "Upgrade to Pro for unlimited requests with $5 included credit.",
					};
				}
				if (error instanceof InsufficientBalanceError) {
					set.status = 402;
					return {
						error: "insufficient_balance" as const,
						message: "Your usage credit has been exhausted.",
						balance: error.balance,
						plan: error.plan,
						actions: {
							buyCredits: "https://ultrahope.dev/settings/billing#credits",
							enableAutoRecharge:
								"https://ultrahope.dev/settings/billing#auto-recharge",
						},
						hint: "Purchase additional credits or enable auto-recharge to continue.",
					};
				}
				throw error;
			}
		},
		{
			body: t.Object({
				input: t.String(),
				model: t.String(),
				target: t.Union([
					t.Literal("vcs-commit-message"),
					t.Literal("pr-title-body"),
					t.Literal("pr-intent"),
				]),
			}),
			response: {
				200: t.Object({
					output: t.String(),
					content: t.String(),
					vendor: t.String(),
					model: t.String(),
					inputTokens: t.Number(),
					outputTokens: t.Number(),
					cachedInputTokens: t.Optional(t.Number()),
					cost: t.Optional(t.Number()),
					generationId: t.Optional(t.String()),
				}),
				400: t.Object({
					error: t.String(),
				}),
				401: t.Object({
					error: t.String(),
				}),
				402: t.Union([
					t.Object({
						error: t.Literal("daily_limit_exceeded"),
						message: t.String(),
						count: t.Number(),
						limit: t.Number(),
						resetsAt: t.String(),
						plan: t.Literal("free"),
						actions: t.Object({
							upgrade: t.String(),
						}),
						hint: t.String(),
					}),
					t.Object({
						error: t.Literal("insufficient_balance"),
						message: t.String(),
						balance: t.Number(),
						plan: t.Union([t.Literal("free"), t.Literal("pro")]),
						actions: t.Object({
							buyCredits: t.Optional(t.String()),
							enableAutoRecharge: t.Optional(t.String()),
							upgrade: t.Optional(t.String()),
						}),
						hint: t.String(),
					}),
				]),
			},
			detail: {
				summary: "Translate input into a structured output",
				tags: ["translate"],
				security: [{ bearerAuth: [] }],
			},
		},
	)
	.get("/health", () => ({ status: "ok" }), {
		response: {
			200: t.Object({
				status: t.String(),
			}),
		},
		detail: {
			summary: "Health check",
			tags: ["health"],
		},
	});

export type App = typeof app;
