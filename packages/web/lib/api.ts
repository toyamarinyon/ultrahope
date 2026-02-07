import { readFileSync } from "node:fs";
import { openapi } from "@elysiajs/openapi";
import type { LanguageModelUsage, ProviderMetadata } from "ai";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import {
	commandExecution,
	type Db,
	generation,
	generationScore,
	getDb,
} from "@/db";
import { getAuth, getPolarClient } from "@/lib/auth";
import {
	assertDailyLimitNotExceeded,
	getDailyUsageInfo,
} from "@/lib/daily-limit";
import {
	DailyLimitExceededError,
	generateCommitMessage,
	generateCommitMessageStream,
	generatePrIntent,
	generatePrTitleBody,
	getUserBillingInfo,
	type LLMResponse,
} from "@/lib/llm";
import { buildResponse } from "@/lib/llm/llm-utils";
import type { LanguageModel } from "./llm/types";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version?: string };

const MICRODOLLARS_PER_USD = 1_000_000;
const VERBOSE = process.env.VERBOSE === "1";
const MOCKING = process.env.MOCKING === "1";
const SKIP_DAILY_LIMIT_CHECK =
	process.env.NODE_ENV !== "production" &&
	process.env.SKIP_DAILY_LIMIT_CHECK === "1";

function formatVerboseError(error: unknown): Record<string, unknown> | unknown {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}
	return error;
}

type GenerateContext = {
	userId: number;
	cliSessionId: string;
	model: LanguageModel;
	abortSignal: AbortSignal;
	db: Db;
};

type GenerateResult =
	| {
			success: true;
			response: LLMResponse & { output: string };
			quota?: { remaining: number; limit: number; resetsAt: string };
	  }
	| {
			success: false;
			status: 402;
			body: DailyLimitExceededBody | InsufficientBalanceBody;
	  };

type DailyLimitExceededBody = {
	error: "daily_limit_exceeded";
	message: string;
	count: number;
	limit: number;
	resetsAt: string;
	plan: "free";
	actions: { upgrade: string };
	hint: string;
};

type InsufficientBalanceBody = {
	error: "insufficient_balance";
	message: string;
	balance: number;
	plan: "free" | "pro";
	actions: { buyCredits: string; enableAutoRecharge: string };
	hint: string;
};

type CommitMessageStreamEvent =
	| { type: "commit-message"; commitMessage: string }
	| { type: "usage"; usage: LanguageModelUsage }
	| {
			type: "provider-metadata";
			providerMetadata: ProviderMetadata | undefined;
	  }
	| { type: "error"; message: string };

const encoder = new TextEncoder();

function formatEvent(event: CommitMessageStreamEvent): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function combineAbortSignals(
	primary: AbortSignal,
	secondary: AbortSignal,
): AbortSignal {
	if (primary.aborted) {
		return primary;
	}
	if (secondary.aborted) {
		return secondary;
	}
	const controller = new AbortController();
	const onAbort = (signal: AbortSignal) => {
		if (!controller.signal.aborted) {
			controller.abort(signal.reason);
		}
	};
	primary.addEventListener("abort", () => onAbort(primary), { once: true });
	secondary.addEventListener("abort", () => onAbort(secondary), { once: true });
	return controller.signal;
}

type BillingInfoResult =
	| {
			billingInfo: Awaited<ReturnType<typeof getUserBillingInfo>>;
			plan: "free" | "pro";
	  }
	| {
			status: 503;
			errorBody: { error: "billing_unavailable"; message: string };
	  };

async function getBillingInfoOr503(
	userId: number,
	generationAbortController: AbortController,
	set: { status?: number | string },
): Promise<BillingInfoResult> {
	const billingInfoPromise = getUserBillingInfo(userId, {
		throwOnError: true,
	});
	try {
		const billingInfo = await billingInfoPromise;
		return { billingInfo, plan: billingInfo?.plan ?? "free" };
	} catch (_error) {
		generationAbortController.abort("billing_unavailable");
		set.status = 503;
		return {
			status: 503,
			errorBody: {
				error: "billing_unavailable",
				message: "Unable to verify billing info.",
			},
		};
	}
}

async function enforceDailyLimitOr402(
	db: Db,
	userId: number,
	plan: "free" | "pro",
	generationAbortController: AbortController,
	set: { status?: number | string },
): Promise<null | { status: 402; errorBody: DailyLimitExceededBody }> {
	try {
		if (plan === "free" && !MOCKING && !SKIP_DAILY_LIMIT_CHECK) {
			await assertDailyLimitNotExceeded(db, userId);
		} else if (MOCKING) {
			console.log("[MOCKING] Daily limit check bypassed");
		} else if (SKIP_DAILY_LIMIT_CHECK) {
			console.log("[SKIP_DAILY_LIMIT_CHECK] Daily limit check bypassed");
		}
	} catch (error) {
		generationAbortController.abort("daily_limit_exceeded");
		if (error instanceof DailyLimitExceededError) {
			set.status = 402;
			return {
				status: 402,
				errorBody: {
					error: "daily_limit_exceeded",
					message: "Daily request limit reached.",
					count: error.count,
					limit: error.limit,
					resetsAt: error.resetsAt.toISOString(),
					plan: "free",
					actions: {
						upgrade: "https://ultrahope.dev/pricing",
					},
					hint: "Upgrade to Pro for unlimited requests with $5 included credit.",
				},
			};
		}
		throw error;
	}

	return null;
}

function enforceProBalanceOr402(
	plan: "free" | "pro",
	billingInfo: Awaited<ReturnType<typeof getUserBillingInfo>>,
	generationAbortController: AbortController,
	set: { status?: number | string },
): null | { status: 402; errorBody: InsufficientBalanceBody } {
	if (plan === "pro" && billingInfo && billingInfo.balance <= 0) {
		generationAbortController.abort("insufficient_balance");
		set.status = 402;
		return {
			status: 402,
			errorBody: {
				error: "insufficient_balance",
				message: "Your usage credit has been exhausted.",
				balance: billingInfo.balance,
				plan: billingInfo.plan,
				actions: {
					buyCredits: "https://ultrahope.dev/settings/billing#credits",
					enableAutoRecharge:
						"https://ultrahope.dev/settings/billing#auto-recharge",
				},
				hint: "Purchase additional credits or enable auto-recharge to continue.",
			},
		};
	}

	return null;
}

async function fetchCommandExecutionId(
	db: Db,
	cliSessionId: string,
	userId: number,
): Promise<number | undefined> {
	const commandExecutionRow = await db
		.select({ id: commandExecution.id })
		.from(commandExecution)
		.where(
			and(
				eq(commandExecution.cliSessionId, cliSessionId),
				eq(commandExecution.userId, userId),
			),
		)
		.limit(1);
	return commandExecutionRow[0]?.id;
}

function ingestUsageEvent({
	userId,
	costInMicrodollars,
	model,
	vendor,
	generationId,
}: {
	userId: number;
	costInMicrodollars: number;
	model: string;
	vendor: string;
	generationId: string;
}): void {
	if (costInMicrodollars <= 0) return;

	const polarClient = getPolarClient();
	polarClient.events
		.ingest({
			events: [
				{
					name: "usage",
					externalCustomerId: userId.toString(),
					metadata: {
						cost: costInMicrodollars,
						model,
						provider: vendor,
						generationId,
					},
				},
			],
		})
		.catch((error) => {
			console.error("[polar] Failed to ingest usage event:", error);
		});
}

type CommitMessageStreamOptions = {
	stream: ReturnType<typeof generateCommitMessageStream>;
	ctx: GenerateContext;
	startedAt: number;
	db: Db;
};

function createCommitMessageSSEStream({
	stream,
	ctx,
	startedAt,
	db,
}: CommitMessageStreamOptions): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				let rawCommitMessage = "";
				let lastCommitMessage = "";

				console.log("[DEBUG:SSE] Starting to consume textStream for model:", ctx.model);

				for await (const chunk of stream.textStream) {
					console.log("[DEBUG:SSE] chunk received:", JSON.stringify(chunk));
					rawCommitMessage += chunk;
					const commitMessage = rawCommitMessage.replace(/\s+/g, " ").trim();
					if (VERBOSE) {
						console.log(chunk);
						console.log(commitMessage);
					}
					if (!commitMessage) continue;
					lastCommitMessage = commitMessage;
					controller.enqueue(
						formatEvent({ type: "commit-message", commitMessage }),
					);
				}
				console.log("[DEBUG:SSE] textStream exhausted. Final raw:", JSON.stringify(rawCommitMessage));

				const finalCommitMessage = rawCommitMessage.replace(/\s+/g, " ").trim();
				if (finalCommitMessage && finalCommitMessage !== lastCommitMessage) {
					lastCommitMessage = finalCommitMessage;
					controller.enqueue(
						formatEvent({
							type: "commit-message",
							commitMessage: finalCommitMessage,
						}),
					);
				}

				const [usage, providerMetadata, commandExecutionId] = await Promise.all(
					[
						stream.totalUsage,
						stream.providerMetadata,
						fetchCommandExecutionId(db, ctx.cliSessionId, ctx.userId),
					],
				);

				const response = buildResponse(
					{
						text: finalCommitMessage ?? lastCommitMessage,
						usage: {
							inputTokens: usage.inputTokens,
							outputTokens: usage.outputTokens,
						},
						providerMetadata,
					},
					ctx.model,
				);

				const costInMicrodollars =
					response.cost != null
						? Math.round(response.cost * MICRODOLLARS_PER_USD)
						: 0;

				if (response.generationId) {
					ingestUsageEvent({
						userId: ctx.userId,
						costInMicrodollars,
						model: response.model,
						vendor: response.vendor,
						generationId: response.generationId,
					});

					if (commandExecutionId) {
						db.insert(generation)
							.values({
								commandExecutionId,
								vercelAiGatewayGenerationId: response.generationId,
								providerName: response.vendor,
								model: response.model,
								cost: costInMicrodollars,
								latency: Date.now() - startedAt,
								createdAt: new Date(),
								gatewayPayload: null,
								output: response.content,
							})
							.catch((error) => {
								console.error("[usage] Failed to persist generation:", error);
							});
					} else {
						console.warn(
							"[usage] Missing commandExecutionId for cliSessionId:",
							ctx.cliSessionId,
						);
					}
				} else {
					console.warn(
						"[usage] Missing generationId; skipping generation insert.",
					);
				}

				controller.enqueue(formatEvent({ type: "usage", usage }));
				controller.enqueue(
					formatEvent({ type: "provider-metadata", providerMetadata }),
				);
				controller.close();
			} catch (error) {
				if (error instanceof Error) {
					console.error("[DEBUG:SSE] error.name:", error.name);
					if ("value" in error) {
						console.error("[DEBUG:SSE] error.value:", JSON.stringify((error as any).value, null, 2));
					}
				}
				const message = error instanceof Error ? error.message : String(error);
				controller.enqueue(formatEvent({ type: "error", message }));
				controller.close();
			}
		},
	});
}

async function executeGeneration(
	ctx: GenerateContext,
	generateFn: (abortSignal: AbortSignal) => Promise<LLMResponse>,
): Promise<GenerateResult> {
	const startedAt = Date.now();
	const billingInfoPromise = getUserBillingInfo(ctx.userId);
	const generationAbortController = new AbortController();
	const generationSignal = combineAbortSignals(
		ctx.abortSignal,
		generationAbortController.signal,
	);
	const generationPromise = generateFn(generationSignal);
	const billingInfo = await billingInfoPromise;
	const plan = billingInfo?.plan ?? "free";

	if (plan === "pro" && billingInfo && billingInfo.balance <= 0) {
		generationAbortController.abort("insufficient_balance");
		void generationPromise.catch(() => undefined);
		return {
			success: false,
			status: 402,
			body: {
				error: "insufficient_balance",
				message: "Your usage credit has been exhausted.",
				balance: billingInfo.balance,
				plan: billingInfo.plan,
				actions: {
					buyCredits: "https://ultrahope.dev/settings/billing#credits",
					enableAutoRecharge:
						"https://ultrahope.dev/settings/billing#auto-recharge",
				},
				hint: "Purchase additional credits or enable auto-recharge to continue.",
			},
		};
	}

	const [response, commandExecutionRow] = await Promise.all([
		generationPromise,
		ctx.db
			.select({ id: commandExecution.id })
			.from(commandExecution)
			.where(
				and(
					eq(commandExecution.cliSessionId, ctx.cliSessionId),
					eq(commandExecution.userId, ctx.userId),
				),
			)
			.limit(1),
	]);

	const commandExecutionId = commandExecutionRow[0]?.id;

	const costInMicrodollars =
		response.cost != null
			? Math.round(response.cost * MICRODOLLARS_PER_USD)
			: 0;

	if (response.generationId) {
		ingestUsageEvent({
			userId: ctx.userId,
			costInMicrodollars,
			model: response.model,
			vendor: response.vendor,
			generationId: response.generationId,
		});

		if (commandExecutionId) {
			ctx.db
				.insert(generation)
				.values({
					commandExecutionId,
					vercelAiGatewayGenerationId: response.generationId,
					providerName: response.vendor,
					model: response.model,
					cost: costInMicrodollars,
					latency: Date.now() - startedAt,
					createdAt: new Date(),
					gatewayPayload: null,
					output: response.content,
				})
				.catch((error) => {
					console.error("[usage] Failed to persist generation:", error);
				});
		} else {
			console.warn(
				"[usage] Missing commandExecutionId for cliSessionId:",
				ctx.cliSessionId,
			);
		}
	} else {
		console.warn("[usage] Missing generationId; skipping generation insert.");
	}

	const result: GenerateResult = {
		success: true,
		response: { output: response.content, ...response },
	};

	if (plan === "free") {
		const usageInfo = await getDailyUsageInfo(ctx.db, ctx.userId);
		result.quota = {
			remaining: usageInfo.remaining,
			limit: usageInfo.limit,
			resetsAt: usageInfo.resetsAt.toISOString(),
		};
	}

	return result;
}

const GenerateBodySchema = t.Object({
	cliSessionId: t.String(),
	input: t.String(),
	model: t.String(),
});

const GenerateSuccessResponse = t.Object({
	output: t.String(),
	content: t.String(),
	vendor: t.String(),
	model: t.String(),
	inputTokens: t.Number(),
	outputTokens: t.Number(),
	cachedInputTokens: t.Optional(t.Number()),
	cost: t.Optional(t.Number()),
	generationId: t.String(),
	quota: t.Optional(
		t.Object({
			remaining: t.Number(),
			limit: t.Number(),
			resetsAt: t.String(),
		}),
	),
});

const GenerateErrorResponses = {
	401: t.Object({ error: t.String() }),
	402: t.Union([
		t.Object({
			error: t.Literal("daily_limit_exceeded"),
			message: t.String(),
			count: t.Number(),
			limit: t.Number(),
			resetsAt: t.String(),
			plan: t.Literal("free"),
			actions: t.Object({ upgrade: t.String() }),
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
};

const rootApp = new Elysia({ prefix: "/api" }).use(
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
);

const apiRoutes = new Elysia()
	.derive(() => ({
		db: getDb(),
	}))
	.resolve(async ({ request: { headers } }) => {
		const auth = getAuth();
		const session = await auth.api.getSession({ headers });
		if (session === null) {
			return {
				session: undefined,
			};
		}
		return {
			session: {
				session,
				user: {
					...session.user,
					id: Number.parseInt(session.user.id, 10),
				},
			},
		};
	})
	.onError(({ code, error, request, set, body, params, query }) => {
		if (!VERBOSE) return;
		if (set.status !== 422 && code !== "VALIDATION") return;
		const url = new URL(request.url);
		console.log("[VERBOSE] 422 validation error", {
			method: request.method,
			path: url.pathname,
			status: set.status,
			code,
			error: formatVerboseError(error),
			body,
			params,
			query,
		});
	})
	.post(
		"/v1/command_execution",
		async ({ body, session, set, db }) => {
			if (!session) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			try {
				const billingInfo = await getUserBillingInfo(session.user.id);
				const plan = billingInfo?.plan ?? "free";

				if (plan === "free" && !MOCKING && !SKIP_DAILY_LIMIT_CHECK) {
					await assertDailyLimitNotExceeded(db, session.user.id);
				} else if (MOCKING) {
					console.log("[MOCKING] Daily limit check bypassed");
				} else if (SKIP_DAILY_LIMIT_CHECK) {
					console.log("[SKIP_DAILY_LIMIT_CHECK] Daily limit check bypassed");
				}

				await db
					.insert(commandExecution)
					.values({
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
		"/v1/commit-message",
		async ({ body, session, set, request, db }) => {
			if (!session) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			if (MOCKING) {
				console.log("[MOCKING] Using mocking model");
			}

			const ctx: GenerateContext = {
				userId: session.user.id,
				cliSessionId: body.cliSessionId,
				model: MOCKING ? "mocking" : body.model,
				abortSignal: request.signal,
				db,
			};

			const result = await executeGeneration(ctx, (abortSignal) =>
				generateCommitMessage(body.input, {
					model: ctx.model,
					abortSignal,
				}),
			);

			if (!result.success) {
				set.status = result.status;
				return result.body;
			}

			return result.quota
				? { ...result.response, quota: result.quota }
				: result.response;
		},
		{
			body: GenerateBodySchema,
			response: {
				200: GenerateSuccessResponse,
				...GenerateErrorResponses,
			},
			detail: {
				summary: "Generate a commit message from a diff",
				tags: ["generate"],
				security: [{ bearerAuth: [] }],
			},
		},
	)
	.post(
		"/v1/commit-message/stream",
		async ({ body, session, set, request, db }) => {
			if (!session) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			if (MOCKING) {
				console.log("[MOCKING] Using mocking model");
			}

			const ctx: GenerateContext = {
				userId: session.user.id,
				cliSessionId: body.cliSessionId,
				model: MOCKING ? "mocking" : body.model,
				abortSignal: request.signal,
				db,
			};

			const startedAt = Date.now();
			const generationAbortController = new AbortController();
			const generationSignal = combineAbortSignals(
				ctx.abortSignal,
				generationAbortController.signal,
			);
			const stream = generateCommitMessageStream(body.input, {
				model: ctx.model,
				abortSignal: generationSignal,
			});
			const billingInfoResult = await getBillingInfoOr503(
				ctx.userId,
				generationAbortController,
				set,
			);
			if ("errorBody" in billingInfoResult) {
				return billingInfoResult.errorBody;
			}
			const { billingInfo, plan } = billingInfoResult;

			const dailyLimitResult = await enforceDailyLimitOr402(
				db,
				session.user.id,
				plan,
				generationAbortController,
				set,
			);
			if (dailyLimitResult) {
				return dailyLimitResult.errorBody;
			}

			const balanceResult = enforceProBalanceOr402(
				plan,
				billingInfo,
				generationAbortController,
				set,
			);
			if (balanceResult) {
				return balanceResult.errorBody;
			}

			const customStream = createCommitMessageSSEStream({
				stream,
				ctx,
				startedAt,
				db,
			});

			return new Response(customStream, {
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				},
			});
		},
		{
			body: GenerateBodySchema,
			detail: {
				summary: "Stream a commit message from a diff",
				tags: ["generate"],
				security: [{ bearerAuth: [] }],
			},
		},
	)
	.post(
		"/v1/pr-title-body",
		async ({ body, session, set, request, db }) => {
			if (!session) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			if (MOCKING) {
				console.log("[MOCKING] Using mocking model");
			}

			const ctx: GenerateContext = {
				userId: session.user.id,
				cliSessionId: body.cliSessionId,
				model: MOCKING ? "mocking" : body.model,
				abortSignal: request.signal,
				db,
			};

			const result = await executeGeneration(ctx, (abortSignal) =>
				generatePrTitleBody(body.input, {
					model: ctx.model as Parameters<
						typeof generatePrTitleBody
					>[1]["model"],
					abortSignal,
				}),
			);

			if (!result.success) {
				set.status = result.status;
				return result.body;
			}

			return result.quota
				? { ...result.response, quota: result.quota }
				: result.response;
		},
		{
			body: GenerateBodySchema,
			response: {
				200: GenerateSuccessResponse,
				...GenerateErrorResponses,
			},
			detail: {
				summary: "Generate a PR title and body from git log",
				tags: ["generate"],
				security: [{ bearerAuth: [] }],
			},
		},
	)
	.post(
		"/v1/pr-intent",
		async ({ body, session, set, request, db }) => {
			if (!session) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			if (MOCKING) {
				console.log("[MOCKING] Using mocking model");
			}

			const ctx: GenerateContext = {
				userId: session.user.id,
				cliSessionId: body.cliSessionId,
				model: MOCKING ? "mocking" : body.model,
				abortSignal: request.signal,
				db,
			};

			const result = await executeGeneration(ctx, (abortSignal) =>
				generatePrIntent(body.input, {
					model: ctx.model as Parameters<typeof generatePrIntent>[1]["model"],
					abortSignal,
				}),
			);

			if (!result.success) {
				set.status = result.status;
				return result.body;
			}

			return result.quota
				? { ...result.response, quota: result.quota }
				: result.response;
		},
		{
			body: GenerateBodySchema,
			response: {
				200: GenerateSuccessResponse,
				...GenerateErrorResponses,
			},
			detail: {
				summary: "Generate a PR intent summary from a diff",
				tags: ["generate"],
				security: [{ bearerAuth: [] }],
			},
		},
	)
	.post(
		"/v1/generation_score",
		async ({ body, session, set, db }) => {
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
				generationId,
				value: body.value,
				createdAt: new Date(),
			});

			return { ok: true };
		},
		{
			body: t.Object({
				generationId: t.String(),
				value: t.Number(),
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

export const app = rootApp.use(apiRoutes);
