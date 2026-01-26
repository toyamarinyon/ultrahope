import { Elysia, t } from "elysia";
import { auth } from "@/lib/auth";
import { InsufficientBalanceError, translate } from "@/lib/llm";

export const app = new Elysia({ prefix: "/api" })
	.derive(async ({ request: { headers } }) => {
		const session = await auth.api.getSession({ headers });
		return { session };
	})
	.post(
		"/v1/translate",
		async ({ body, session }) => {
			if (!session) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), {
					status: 401,
				});
			}

			const validTargets = ["vcs-commit-message", "pr-title-body", "pr-intent"];
			if (!validTargets.includes(body.target)) {
				return new Response(
					JSON.stringify({ error: `Invalid target: ${body.target}` }),
					{
						status: 400,
					},
				);
			}

			try {
				const response = await translate(
					body.input,
					body.target as "vcs-commit-message" | "pr-title-body" | "pr-intent",
					{ externalCustomerId: session.user.id },
				);
				return { output: response.content, ...response };
			} catch (error) {
				if (error instanceof InsufficientBalanceError) {
					const isPro = error.plan === "pro";
					const response = isPro
						? {
								error: "insufficient_balance" as const,
								message: "Your usage credit has been exhausted.",
								balance: error.balance,
								plan: error.plan,
								actions: {
									buyCredits: "https://ultrahope.dev/settings/billing#credits",
									enableAutoRecharge:
										"https://ultrahope.dev/settings/billing#auto-recharge",
								},
								hint: "Purchase additional credits or enable auto-recharge to continue.",
							}
						: {
								error: "insufficient_balance" as const,
								message: "Your free credit has been exhausted.",
								balance: error.balance,
								plan: error.plan,
								actions: {
									upgrade: "https://ultrahope.dev/pricing",
								},
								hint: "Upgrade to Pro for $10/month with $5 included credit and one-time credit purchases.",
							};

					return new Response(JSON.stringify(response), { status: 402 });
				}
				throw error;
			}
		},
		{
			body: t.Object({
				input: t.String(),
				target: t.String(),
			}),
		},
	)
	.get("/health", () => ({ status: "ok" }));

export type App = typeof app;
