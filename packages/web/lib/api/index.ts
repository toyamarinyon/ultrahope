import { openapi } from "@elysiajs/openapi";
import { type AnyElysia, Elysia } from "elysia";
import {
	type ApiDependencies,
	createDefaultApiDependencies,
} from "./dependencies";
import { createCommandExecutionRoutes } from "./routes/command-execution";
import { createCommitMessageRoutes } from "./routes/commit-message";
import { createGenerationScoreRoutes } from "./routes/generation-score";
import { createHealthRoute } from "./routes/health";
import { createPrRoutes } from "./routes/pr";
import { formatVerboseError } from "./shared/errors";

const VERBOSE = process.env.VERBOSE === "1";

function createAuthPlugin(deps: ApiDependencies) {
	return (app: AnyElysia) =>
		app
			.derive(() => ({
				db: deps.getDb(),
			}))
			.resolve(async ({ request: { headers } }) => {
				const auth = deps.getAuth();
				const session = await auth.api.getSession({ headers });
				if (session === null) {
					return { session: undefined };
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
			});
}

export function createApiApp(
	deps: ApiDependencies = createDefaultApiDependencies(),
) {
	const openApiPlugin = createAuthPlugin(deps)(
		new Elysia({ prefix: "/api" }).use(
			openapi({
				path: "/openapi",
				specPath: "/openapi/json",
				documentation: {
					info: {
						title: "Ultrahope API",
						version: deps.getPackageVersion(),
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
		),
	);

	return openApiPlugin
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
		.use(createCommandExecutionRoutes(deps))
		.use(createCommitMessageRoutes(deps))
		.use(createPrRoutes(deps))
		.use(createGenerationScoreRoutes(deps))
		.use(createHealthRoute());
}

export const app = createApiApp();
