import { Elysia } from "elysia";
import { auth } from "@/lib/auth";
import { translate } from "@/lib/llm";

const app = new Elysia({ prefix: "/api" })
	.derive(async ({ request: { headers } }) => {
		const session = await auth.api.getSession({ headers });
		return { session };
	})
	.post("/v1/translate", async ({ body, session }) => {
		if (!session) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
			});
		}

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
	})
	.get("/health", () => ({ status: "ok" }));

export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const DELETE = app.handle;
export const PATCH = app.handle;
export const OPTIONS = app.handle;
