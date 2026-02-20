import type { ProviderMetadata } from "ai";
import { Elysia } from "elysia";
import type { Db } from "@/db/client";
import type { ApiDependencies } from "../dependencies";
import { invalidModelErrorBody, unauthorizedBody } from "../shared/errors";
import {
	executeGeneration,
	finalizeStreamingGeneration,
} from "../shared/generation-service";
import {
	createCommitMessageSanitizer,
	formatSseEvent,
	normalizeCommitMessage,
	trimCommitMessageWrappers,
} from "../shared/stream-service";
import {
	combineAbortSignals,
	enforceDailyLimitOr402,
	enforceProBalanceOr402,
	getBillingInfoOr503,
} from "../shared/usage-guard";
import {
	GenerateBodySchema,
	GenerateErrorResponseSchemas,
	GenerateSuccessResponseSchema,
	isModelAllowed,
} from "../shared/validators";

type ApiSession = {
	user: {
		id: number;
	};
};

type CommitMessageRouteContext = {
	body: {
		cliSessionId: string;
		input: string;
		model: string;
		hint?: string;
	};
	session?: ApiSession;
	set: {
		status?: number | string;
	};
	request: Request;
	db?: Db;
};

type CommitMessageStreamEventPayload =
	| ({ atMs?: number } & { type: "commit-message"; commitMessage: string })
	| ({ atMs?: number } & {
			type: "usage";
			usage: { inputTokens: number; outputTokens: number };
	  })
	| ({ atMs?: number } & {
			type: "provider-metadata";
			providerMetadata: ProviderMetadata | undefined;
	  })
	| ({ atMs?: number } & { type: "error"; message: string });

export function createCommitMessageRoutes(deps: ApiDependencies): Elysia {
	return new Elysia()
		.post(
			"/v1/commit-message",
			async ({
				body,
				session,
				set,
				request,
				db,
			}: CommitMessageRouteContext) => {
				if (!session) {
					set.status = 401;
					return unauthorizedBody;
				}
				if (!db) {
					set.status = 500;
					return { error: "Database unavailable" };
				}

				if (!isModelAllowed(body.model)) {
					set.status = 400;
					return invalidModelErrorBody(body.model);
				}

				const ctx = {
					userId: session.user.id,
					cliSessionId: body.cliSessionId,
					model: body.model,
					abortSignal: request.signal,
					db,
				};

				const result = await executeGeneration(
					ctx,
					(abortSignal) =>
						deps.generateCommitMessage(body.input, {
							model: body.model,
							abortSignal,
							hint: body.hint,
						}),
					deps,
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
					200: GenerateSuccessResponseSchema,
					...GenerateErrorResponseSchemas,
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
			async ({
				body,
				session,
				set,
				request,
				db,
			}: CommitMessageRouteContext) => {
				if (!session) {
					set.status = 401;
					return unauthorizedBody;
				}
				if (!db) {
					set.status = 500;
					return { error: "Database unavailable" };
				}

				if (!isModelAllowed(body.model)) {
					set.status = 400;
					return invalidModelErrorBody(body.model);
				}

				const ctx = {
					userId: session.user.id,
					cliSessionId: body.cliSessionId,
					model: body.model,
					abortSignal: request.signal,
					db,
				};

				const startedAt = Date.now();
				const generationAbortController = new AbortController();
				const generationSignal = combineAbortSignals(
					ctx.abortSignal,
					generationAbortController.signal,
				);

				const billingInfoResult = await getBillingInfoOr503({
					userId: session.user.id,
					getUserBillingInfo: (userId) =>
						deps.getUserBillingInfo(userId, { throwOnError: true }),
					set,
					generationAbortController,
				});
				if (billingInfoResult.status === 503) {
					return billingInfoResult.errorBody;
				}

				const { billingInfo, plan } = billingInfoResult;

				const dailyLimitResult = await enforceDailyLimitOr402(
					{
						assertDailyLimitNotExceeded: deps.assertDailyLimitNotExceeded,
						baseUrl: deps.baseUrl,
					},
					{
						db,
						userId: session.user.id,
						plan,
						generationAbortController,
						set,
					},
				);
				if (dailyLimitResult) {
					return dailyLimitResult.errorBody;
				}

				const balanceResult = enforceProBalanceOr402(
					{
						baseUrl: deps.baseUrl,
					},
					{
						plan,
						billingInfo,
						generationAbortController,
						set,
					},
				);
				if (balanceResult) {
					return balanceResult.errorBody;
				}

				const stream = deps.generateCommitMessageStream(body.input, {
					model: body.model,
					abortSignal: generationSignal,
					hint: body.hint,
				});
				const sanitizer = createCommitMessageSanitizer();
				const streamStartedAtMs = Date.now();
				let sanitizedCommitMessage = "";
				let lastCommitMessage = "";
				let finalCommitMessage = "";
				const customStream = new ReadableStream<Uint8Array>({
					async start(controller) {
						const emitEvent = (event: CommitMessageStreamEventPayload) => {
							controller.enqueue(
								formatSseEvent({
									...event,
									atMs: Date.now() - streamStartedAtMs,
								}),
							);
						};

						try {
							for await (const chunk of stream.textStream) {
								const sanitizedChunk = sanitizer.push(chunk);
								sanitizedCommitMessage += sanitizedChunk;
								const commitMessage = trimCommitMessageWrappers(
									normalizeCommitMessage(sanitizedCommitMessage),
								);
								if (!commitMessage) {
									continue;
								}
								lastCommitMessage = commitMessage;
								emitEvent({ type: "commit-message", commitMessage });
							}

							sanitizedCommitMessage += sanitizer.finish();
							finalCommitMessage = trimCommitMessageWrappers(
								normalizeCommitMessage(sanitizedCommitMessage),
							);
							if (
								finalCommitMessage &&
								finalCommitMessage !== lastCommitMessage
							) {
								lastCommitMessage = finalCommitMessage;
								emitEvent({
									type: "commit-message",
									commitMessage: finalCommitMessage,
								});
							}

							const finalized = await finalizeStreamingGeneration(
								{
									totalUsage: stream.totalUsage,
									providerMetadata: stream.providerMetadata,
									textStream: stream.textStream,
								},
								{
									ctx,
									model: body.model,
									responseText: finalCommitMessage || lastCommitMessage,
									startedAt,
									storage: deps.storage,
									db,
									baseUrl: deps.baseUrl,
									microDollarsPerUsd: deps.microDollarsPerUsd,
									getPolarClient: deps.getPolarClient,
								},
							);
							emitEvent({ type: "usage", usage: finalized.usage });
							emitEvent({
								type: "provider-metadata",
								providerMetadata: finalized.providerMetadata,
							});
							controller.close();
						} catch (error) {
							emitEvent({
								type: "error",
								message: error instanceof Error ? error.message : String(error),
							});
							controller.close();
						}
					},
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
		) as unknown as Elysia;
}
