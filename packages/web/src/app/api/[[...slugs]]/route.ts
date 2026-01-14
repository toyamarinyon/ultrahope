import { Elysia } from "elysia";
import { auth } from "@/lib/auth";
import { translate } from "@/lib/llm";

const betterAuthPlugin = new Elysia({ name: "better-auth" })
	.mount(auth.handler)
	.macro({
		auth: {
			async resolve({ status, request: { headers } }) {
				const session = await auth.api.getSession({ headers });
				if (!session) return status(401);
				return {
					user: session.user,
					session: session.session,
				};
			},
		},
	});

const app = new Elysia({ prefix: "/api" })
	.use(betterAuthPlugin)
	.post(
		"/v1/translate",
		async ({ body }) => {
			const { input, target } = body as { input: string; target: string };

			const validTargets = ["vcs-commit-message", "pr-title-body", "pr-intent"];
			if (!validTargets.includes(target)) {
				return new Response(
					JSON.stringify({ error: `Invalid target: ${target}` }),
					{
						status: 400,
					},
				);
			}

			const output = await translate(
				input,
				target as "vcs-commit-message" | "pr-title-body" | "pr-intent",
			);
			return { output };
		},
		{ auth: true },
	)
	.get("/health", () => ({ status: "ok" }));

export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const DELETE = app.handle;
export const PATCH = app.handle;
export const OPTIONS = app.handle;
