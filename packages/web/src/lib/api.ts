import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { openapi } from "@elysiajs/openapi";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/db/client";
import { commandExecution, generation, generationScore } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertDailyLimitNotExceeded } from "@/lib/daily-limit";
import {
	DailyLimitExceededError,
	getUserBillingInfo,
	InsufficientBalanceError,
	translate,
} from "@/lib/llm";

const packageJson = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version?: string };

const MICRODOLLARS_PER_USD = 1_000_000;
const TRANSLATE_TARGETS = [
	"vcs-commit-message",
	"pr-title-body",
	"pr-intent",
] as const;

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
		"/v1/command_execution",
		async ({ body, session, set }) => {
			if (!session) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			try {
				const billingInfo = await getUserBillingInfo(session.user.id);
				const plan = billingInfo?.plan ?? "free";

				if (plan === "free") {
					await assertDailyLimitNotExceeded(session.user.id);
				}

				await db
					.insert(commandExecution)
					.values({
						id: body.commandExecutionId,
						cliSessionId: body.cliSessionId,
						userId: session.user.id,
						command: body.command,
						args: JSON.stringify(body.args),
						api: body.api,
						requestPayload: body.requestPayload,
						startedAt: new Date(),
						finishedAt: null,
					})
					.onConflictDoNothing();

				return { commandExecutionId: body.commandExecutionId };
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
				throw error;
			}
		},
		{
			body: t.Object({
				commandExecutionId: t.String(),
				cliSessionId: t.String(),
				command: t.String(),
				args: t.Array(t.String()),
				api: t.String(),
				requestPayload: t.Object({
					input: t.String(),
					target: t.Union([
						t.Literal("vcs-commit-message"),
						t.Literal("pr-title-body"),
						t.Literal("pr-intent"),
					]),
					model: t.Optional(t.String()),
					models: t.Optional(t.Array(t.String())),
				}),
			}),
			response: {
				200: t.Object({
					commandExecutionId: t.String(),
				}),
				401: t.Object({
					error: t.String(),
				}),
				402: t.Object({
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
			},
			detail: {
				summary: "Create a command execution record",
				tags: ["command_execution"],
				security: [{ bearerAuth: [] }],
			},
		},
	)
	.post(
		"/v1/translate",
		async ({ body, session, set, request }) => {
			if (!session) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			if (!TRANSLATE_TARGETS.includes(body.target)) {
				set.status = 400;
				return { error: `Invalid target: ${body.target}` };
			}

			try {
				const startedAt = Date.now();
				const response = await translate(
					body.input,
					body.target as "vcs-commit-message" | "pr-title-body" | "pr-intent",
					{
						externalCustomerId: session.user.id,
						model: body.model,
						abortSignal: request.signal,
					},
				);

				const costInMicrodollars =
					response.cost != null
						? Math.round(response.cost * MICRODOLLARS_PER_USD)
						: 0;

				if (response.generationId) {
					try {
						await db.insert(generation).values({
							id: randomUUID(),
							commandExecutionId: body.commandExecutionId,
							vercelAiGatewayGenerationId: response.generationId,
							providerName: response.vendor,
							model: response.model,
							cost: costInMicrodollars,
							latency: Date.now() - startedAt,
							createdAt: new Date(),
							gatewayPayload: null,
							output: response.content,
						});
					} catch (error) {
						console.error("[usage] Failed to persist generation:", error);
					}
				} else {
					console.warn(
						"[usage] Missing generationId; skipping generation insert.",
					);
				}

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
				commandExecutionId: t.String(),
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
	.post(
		"/v1/generation_score",
		async ({ body, session, set }) => {
			if (!session) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			const rows = await db
				.select({ generationId: generation.id })
				.from(generation)
				.innerJoin(
					commandExecution,
					eq(generation.commandExecutionId, commandExecution.id),
				)
				.where(
					and(
						eq(generation.vercelAiGatewayGenerationId, body.generationId),
						eq(commandExecution.userId, session.user.id),
					),
				)
				.limit(1);

			const generationId = rows[0]?.generationId;
			if (!generationId) {
				set.status = 404;
				return { error: "Generation not found" };
			}

			await db.insert(generationScore).values({
				id: randomUUID(),
				generationId,
				value: body.value,
				comment: body.comment ?? null,
				createdAt: new Date(),
			});

			return { ok: true };
		},
		{
			body: t.Object({
				generationId: t.String(),
				value: t.Number(),
				comment: t.Optional(t.String()),
			}),
			response: {
				200: t.Object({
					ok: t.Boolean(),
				}),
				401: t.Object({
					error: t.String(),
				}),
				404: t.Object({
					error: t.String(),
				}),
			},
			detail: {
				summary: "Record feedback for a generation",
				tags: ["generation_score"],
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
