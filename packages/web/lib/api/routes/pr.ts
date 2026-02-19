import { Elysia } from "elysia";
import type { ApiDependencies } from "../dependencies";
import { invalidModelErrorBody, unauthorizedBody } from "../shared/errors";
import { executeGeneration } from "../shared/generation-service";
import {
	GenerateBodySchema,
	GenerateErrorResponseSchemas,
	GenerateSuccessResponseSchema,
	isModelAllowed,
} from "../shared/validators";

export function createPrRoutes(deps: ApiDependencies): Elysia {
	return new Elysia()
		.post(
			"/v1/pr-title-body",
			async ({ body, session, set, request, db }: any) => {
				if (!session) {
					set.status = 401;
					return unauthorizedBody;
				}
				if (!isModelAllowed(body.model)) {
					set.status = 400;
					return invalidModelErrorBody(body.model);
				}

				const result = await executeGeneration(
					{
						userId: session.user.id,
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
			async ({ body, session, set, request, db }: any) => {
				if (!session) {
					set.status = 401;
					return unauthorizedBody;
				}
				if (!isModelAllowed(body.model)) {
					set.status = 400;
					return invalidModelErrorBody(body.model);
				}

				const result = await executeGeneration(
					{
						userId: session.user.id,
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
