import { Elysia, t } from "elysia";
import type { ApiDependencies } from "../dependencies";
import { unauthorizedBody } from "../shared/errors";
import { EntitlementResponseSchema } from "../shared/validators";

type ApiSession = {
	user: {
		id: number;
		isAnonymous: boolean;
	};
};

type EntitlementRouteContext = {
	session?: ApiSession;
	set: {
		status?: number | string;
	};
	db?: object;
};

export function createEntitlementRoutes(deps: ApiDependencies): Elysia {
	return new Elysia().get(
		"/v1/entitlement",
		async ({ session, set }: EntitlementRouteContext) => {
			if (!session) {
				set.status = 401;
				return unauthorizedBody;
			}

			if (session.user.isAnonymous) {
				return { entitlement: "anonymous" as const };
			}

			const billingInfo = await deps.getUserBillingInfo(session.user.id, {
				throwOnError: false,
			});
			if (!billingInfo) {
				return { entitlement: "authenticated_unpaid" as const };
			}

			return { entitlement: "pro" as const };
		},
		{
			response: {
				200: EntitlementResponseSchema,
				401: t.Object({ error: t.String() }),
			},
			detail: {
				summary: "Get current authentication entitlement",
				tags: ["entitlement"],
				security: [{ bearerAuth: [] }],
			},
		},
	) as unknown as Elysia;
}
