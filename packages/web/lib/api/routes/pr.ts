import { Elysia } from "elysia";
import type { Db } from "@/db/client";
import type { ApiDependencies } from "../dependencies";
import { invalidModelErrorBody, unauthorizedBody } from "../shared/errors";
import { executeGeneration } from "../shared/generation-service";
import {
	enforceDailyLimitOr402,
	enforceInputLengthLimitOr400,
	FREE_INPUT_LENGTH_LIMIT,
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
		isAnonymous: boolean;
	};
};

type PrRouteContext = {
	body: {
		cliSessionId: string;
		installationId: string;
		input: string;
		model: string;
	};
	session?: ApiSession;
	set: {
		status?: number | string;
	};
	request: Request;
	db?: Db;
};

export function createPrRoutes(deps: ApiDependencies): Elysia {
	return new Elysia()
		.post(
			"/v1/pr-title-body",
			async ({ body, session, set, request, db }: PrRouteContext) => {
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

				const billingInfoResult = await getBillingInfoOr503({
					userId: session.user.id,
					isAnonymous: session.user.isAnonymous,
					getUserBillingInfo: (userId) =>
						deps.getUserBillingInfo(userId, { throwOnError: true }),
					baseUrl: deps.baseUrl,
					set,
				});
				if (billingInfoResult.status === 402) {
					return billingInfoResult.errorBody;
				}
				if (billingInfoResult.status === 503) {
					return billingInfoResult.errorBody;
				}

				const inputLengthResult = enforceInputLengthLimitOr400({
					plan: billingInfoResult.plan,
					input: body.input,
					limit: FREE_INPUT_LENGTH_LIMIT,
					set,
				});
				if (inputLengthResult) {
					return inputLengthResult.errorBody;
				}

				const generationAbortController = new AbortController();
				const dailyLimitResult = await enforceDailyLimitOr402(
					{
						assertDailyLimitNotExceeded: deps.assertDailyLimitNotExceeded,
						baseUrl: deps.baseUrl,
					},
					{
						db,
						installationId: body.installationId,
						plan: billingInfoResult.plan,
						currentCliSessionId: body.cliSessionId,
						generationAbortController,
						set,
					},
				);
				if (dailyLimitResult) {
					return dailyLimitResult.errorBody;
				}

				const result = await executeGeneration(
					{
						userId: session.user.id,
						isAnonymous: session.user.isAnonymous,
						installationId: body.installationId,
						cliSessionId: body.cliSessionId,
						model: body.model,
						abortSignal: request.signal,
						db,
					},
					(abortSignal) =>
						deps.generatePrTitleBody(body.input, {
							model: body.model,
							abortSignal,
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
					summary: "Generate a PR title and body from git log",
					tags: ["generate"],
					security: [{ bearerAuth: [] }],
				},
			},
		)
		.post(
			"/v1/pr-intent",
			async ({ body, session, set, request, db }: PrRouteContext) => {
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

				const billingInfoResult = await getBillingInfoOr503({
					userId: session.user.id,
					isAnonymous: session.user.isAnonymous,
					getUserBillingInfo: (userId) =>
						deps.getUserBillingInfo(userId, { throwOnError: true }),
					baseUrl: deps.baseUrl,
					set,
				});
				if (billingInfoResult.status === 402) {
					return billingInfoResult.errorBody;
				}
				if (billingInfoResult.status === 503) {
					return billingInfoResult.errorBody;
				}

				const inputLengthResult = enforceInputLengthLimitOr400({
					plan: billingInfoResult.plan,
					input: body.input,
					limit: FREE_INPUT_LENGTH_LIMIT,
					set,
				});
				if (inputLengthResult) {
					return inputLengthResult.errorBody;
				}

				const generationAbortController = new AbortController();
				const dailyLimitResult = await enforceDailyLimitOr402(
					{
						assertDailyLimitNotExceeded: deps.assertDailyLimitNotExceeded,
						baseUrl: deps.baseUrl,
					},
					{
						db,
						installationId: body.installationId,
						plan: billingInfoResult.plan,
						currentCliSessionId: body.cliSessionId,
						generationAbortController,
						set,
					},
				);
				if (dailyLimitResult) {
					return dailyLimitResult.errorBody;
				}

				const result = await executeGeneration(
					{
						userId: session.user.id,
						isAnonymous: session.user.isAnonymous,
						installationId: body.installationId,
						cliSessionId: body.cliSessionId,
						model: body.model,
						abortSignal: request.signal,
						db,
					},
					(abortSignal) =>
						deps.generatePrIntent(body.input, {
							model: body.model,
							abortSignal,
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
					summary: "Generate a PR intent summary from a diff",
					tags: ["generate"],
					security: [{ bearerAuth: [] }],
				},
			},
		) as unknown as Elysia;
}
