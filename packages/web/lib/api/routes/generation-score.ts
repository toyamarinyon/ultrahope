import { Elysia, t } from "elysia";
import type { ApiDependencies } from "../dependencies";
import { unauthorizedBody } from "../shared/errors";
import { GenerationScoreBodySchema } from "../shared/validators";

export function createGenerationScoreRoutes(deps: ApiDependencies): Elysia {
	return new Elysia().post(
		"/v1/generation_score",
		async ({ body, session, set, db }: any) => {
			if (!session) {
				set.status = 401;
				return unauthorizedBody;
			}

			const generationId =
				await deps.storage.findGenerationByGenerationIdAndUserId({
					db,
					generationId: body.generationId,
					userId: session.user.id,
				});
			if (!generationId) {
				set.status = 404;
				return { error: "Generation not found" };
			}

			await deps.storage.insertGenerationScore({
				db,
				generationId,
				value: body.value,
				createdAt: new Date(),
			});

			return { ok: true };
		},
		{
			body: GenerationScoreBodySchema,
			response: {
				200: t.Object({ ok: t.Boolean() }),
				401: t.Object({ error: t.String() }),
				404: t.Object({ error: t.String() }),
			},
			detail: {
				summary: "Record feedback for a generation",
				tags: ["generation_score"],
				security: [{ bearerAuth: [] }],
			},
		},
	) as unknown as Elysia;
}
