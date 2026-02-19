import { Elysia, t } from "elysia";

export function createHealthRoute(): Elysia {
	return new Elysia().get("/health", () => ({ status: "ok" }), {
		response: {
			200: t.Object({
				status: t.String(),
			}),
		},
		detail: {
			summary: "Health check",
			tags: ["health"],
		},
	}) as unknown as Elysia;
}
