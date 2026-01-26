import { Elysia } from "elysia";
import { auth } from "@/lib/auth";
import {
	InsufficientBalanceError,
	translate,
	translateMulti,
	translateMultiModel,
} from "@/lib/llm";

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
			models,
		} = body as {
			input: string;
			target: string;
			n?: number;
			models?: string[];
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

		try {
			if (models && models.length > 0) {
				const results = await translateMultiModel(
					input,
					target as "vcs-commit-message" | "pr-title-body" | "pr-intent",
					models,
					{ externalCustomerId: session.user.id },
				);
				return { results };
			}

			const candidateCount = Math.max(1, Math.min(8, Math.floor(n)));

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
							actions: {
								buyCredits: "https://ultrahope.dev/settings/billing#credits",
								enableAutoRecharge:
									"https://ultrahope.dev/settings/billing#auto-recharge",
							},
							hint: "Purchase additional credits or enable auto-recharge to continue.",
						}
					: {
							error: "insufficient_balance",
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
	})
	.get("/health", () => ({ status: "ok" }));

export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const DELETE = app.handle;
export const PATCH = app.handle;
export const OPTIONS = app.handle;
