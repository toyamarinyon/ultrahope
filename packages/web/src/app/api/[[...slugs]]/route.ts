import { Elysia } from "elysia";
import { auth } from "@/lib/auth";
import { InsufficientBalanceError, translate, translateMulti } from "@/lib/llm";

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

		const {
			input,
			target,
			n = 1,
		} = body as {
			input: string;
			target: string;
			n?: number;
		};

		const validTargets = ["vcs-commit-message", "pr-title-body", "pr-intent"];
		if (!validTargets.includes(target)) {
			return new Response(
				JSON.stringify({ error: `Invalid target: ${target}` }),
				{
					status: 400,
				},
			);
		}

		const candidateCount = Math.max(1, Math.min(8, Math.floor(n)));

		try {
			if (candidateCount === 1) {
				const output = await translate(
					input,
					target as "vcs-commit-message" | "pr-title-body" | "pr-intent",
					{ externalCustomerId: session.user.id },
				);
				return { output };
			}

			const outputs = await translateMulti(
				input,
				target as "vcs-commit-message" | "pr-title-body" | "pr-intent",
				candidateCount,
				{ externalCustomerId: session.user.id },
			);
			return { outputs };
		} catch (error) {
			if (error instanceof InsufficientBalanceError) {
				const isPro = error.plan === "pro";
				const response = isPro
					? {
							error: "insufficient_balance",
							message: "Your usage credit has been exhausted.",
							balance: error.balance,
							plan: error.plan,
							overageEnabled: error.allowOverage,
							actions: {
								enableOverage: "https://ultrahope.dev/settings/billing#overage",
								addCredits: "https://ultrahope.dev/settings/billing#credits",
							},
							hint: "Enable pay-as-you-go billing to continue using Ultrahope. You'll be billed at actual cost with no markup.",
						}
					: {
							error: "insufficient_balance",
							message: "Your free credit has been exhausted.",
							balance: error.balance,
							plan: error.plan,
							overageEnabled: false,
							actions: {
								upgrade: "https://ultrahope.dev/pricing",
							},
							hint: "Upgrade to Pro for $10/month with $5 included credit and pay-as-you-go billing.",
						};

				return new Response(JSON.stringify(response), { status: 402 });
			}
			throw error;
		}
	})
	.get("/health", () => ({ status: "ok" }));

export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const DELETE = app.handle;
export const PATCH = app.handle;
export const OPTIONS = app.handle;
