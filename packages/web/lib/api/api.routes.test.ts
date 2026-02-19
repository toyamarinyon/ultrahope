import { describe, expect, it } from "bun:test";
import { DailyLimitExceededError } from "@/lib/util/daily-limit";
import type { ApiDependencies } from "./dependencies";
import { createApiApp } from "./index";
import {
	createBillingUnavailableBody,
	createDailyLimitExceededBody,
	createInsufficientBalanceBody,
	unauthorizedBody,
} from "./shared/errors";
import type { ApiStorage } from "./shared/storage";

type TestStorage = ApiStorage & {
	insertedCommandExecution: boolean;
	insertedGenerationScore: boolean;
};

function createStorage(): TestStorage {
	let insertedCommandExecution = false;
	let insertedGenerationScore = false;

	return {
		insertCommandExecution: async () => {
			insertedCommandExecution = true;
		},
		findCommandExecutionId: async () => 11,
		insertGeneration: async () => {},
		insertGenerationScore: async () => {
			insertedGenerationScore = true;
		},
		findGenerationByGenerationIdAndUserId: async () => 100,
		get insertedCommandExecution() {
			return insertedCommandExecution;
		},
		get insertedGenerationScore() {
			return insertedGenerationScore;
		},
	} as TestStorage;
}

function createDeps(overrides: Partial<ApiDependencies> = {}): ApiDependencies {
	const storage = createStorage();

	return {
		getAuth: () =>
			({
				api: {
					getSession: async () => ({ user: { id: "1001" } }),
				},
			}) as unknown as ReturnType<ApiDependencies["getAuth"]>,
		getDb: () => ({}) as never,
		getPolarClient: () => ({
			events: {
				ingest: () => Promise.resolve(),
			},
		}),
		getUserBillingInfo: async () => ({
			plan: "free",
			balance: 10,
			meterId: "meter",
		}),
		assertDailyLimitNotExceeded: async () => {},
		getDailyUsageInfo: async () => ({
			count: 2,
			limit: 5,
			remaining: 3,
			resetsAt: new Date("2026-01-01T00:00:00.000Z"),
		}),
		generateCommitMessage: async () => ({
			output: "feat: commit",
			content: "feat: commit",
			vendor: "vendor-a",
			model: "model-a",
			inputTokens: 5,
			outputTokens: 3,
			generationId: "gen-1",
		}),
		generateCommitMessageStream: () => {
			const textStream = {
				[Symbol.asyncIterator]: async function* () {
					yield "```feat: done```";
				},
			};
			return {
				textStream,
				totalUsage: Promise.resolve({ inputTokens: 3, outputTokens: 7 }),
				providerMetadata: Promise.resolve({
					model: "model-a",
				}),
			};
		},
		generatePrTitleBody: async () => ({
			output: "feat: title",
			content: "feat: title",
			vendor: "vendor-a",
			model: "model-a",
			inputTokens: 5,
			outputTokens: 2,
			generationId: "gen-2",
		}),
		generatePrIntent: async () => ({
			output: "intent",
			content: "intent",
			vendor: "vendor-a",
			model: "model-a",
			inputTokens: 4,
			outputTokens: 1,
			generationId: "gen-3",
		}),
		storage,
		baseUrl: "https://example.com",
		microDollarsPerUsd: 1_000_000,
		createBillingUnavailableBody,
		createDailyLimitExceededBody,
		createInsufficientBalanceBody,
		getPackageVersion: () => "0.0.1",
		...overrides,
	} as ApiDependencies;
}

function withAuth(unauthorized = false, session: unknown = null) {
	return {
		api: {
			getSession: async () =>
				unauthorized ? null : (session ?? { user: { id: "1001" } }),
		},
	} as unknown as ReturnType<ApiDependencies["getAuth"]>;
}

async function request(
	app: ReturnType<typeof createApiApp>,
	path: string,
	body?: unknown,
	method = "POST",
) {
	return app.handle(
		new Request(`http://localhost${path}`, {
			method,
			headers: body
				? {
						"content-type": "application/json",
					}
				: undefined,
			body: body ? JSON.stringify(body) : undefined,
		}),
	);
}

describe("API route contracts", () => {
	it("returns 401 for unauthenticated command execution", async () => {
		const deps = createDeps({
			getAuth: () => withAuth(true),
			storage: {
				...createStorage(),
				findGenerationByGenerationIdAndUserId: async () => 100,
			},
		});
		const app = createApiApp(deps);

		const response = await request(app, "/api/v1/command_execution", {
			commandExecutionId: "cmd-1",
			cliSessionId: "cli-1",
			command: "git status",
			args: ["--short"],
			api: "cli",
			requestPayload: {
				input: "a",
				target: "vcs-commit-message",
			},
		});
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual(unauthorizedBody);
	});

	it("returns 402 for command execution when daily limit exceeded", async () => {
		const deps = createDeps({
			assertDailyLimitNotExceeded: async () => {
				throw new DailyLimitExceededError(
					5,
					5,
					new Date("2026-01-01T00:00:00.000Z"),
				);
			},
		});
		const app = createApiApp(deps);
		const response = await request(app, "/api/v1/command_execution", {
			commandExecutionId: "cmd-1",
			cliSessionId: "cli-1",
			command: "git status",
			args: ["--short"],
			api: "cli",
			requestPayload: { input: "a", target: "vcs-commit-message" },
		});
		const body = await response.json();

		expect(response.status).toBe(402);
		expect(body.error).toBe("daily_limit_exceeded");
	});

	it("creates command execution record for valid request", async () => {
		const storage = createStorage();
		const deps = createDeps({
			getAuth: () => withAuth(false, { user: { id: "1001" } }),
			storage,
		});
		const app = createApiApp(deps);
		const response = await request(app, "/api/v1/command_execution", {
			commandExecutionId: "cmd-1",
			cliSessionId: "cli-1",
			command: "git status",
			args: ["--short"],
			api: "cli",
			requestPayload: { input: "a", target: "vcs-commit-message" },
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.commandExecutionId).toBe("cmd-1");
		expect(storage.insertedCommandExecution).toBe(true);
	});

	it("returns 400 for invalid model on commit message", async () => {
		const app = createApiApp(createDeps());
		const response = await request(app, "/api/v1/commit-message", {
			cliSessionId: "cli-1",
			input: "diff",
			model: "invalid-model",
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("invalid_model");
	});

	it("returns 402 for commit message when balance is depleted", async () => {
		const deps = createDeps({
			getUserBillingInfo: async () => ({
				plan: "pro",
				balance: 0,
				meterId: "meter",
			}),
		});
		const app = createApiApp(deps);
		const response = await request(app, "/api/v1/commit-message", {
			cliSessionId: "cli-1",
			input: "diff",
			model: "mistral/ministral-3b",
		});
		const body = await response.json();

		expect(response.status).toBe(402);
		expect(body.error).toBe("insufficient_balance");
	});

	it("returns commit message generation success", async () => {
		const app = createApiApp(createDeps());
		const response = await request(app, "/api/v1/commit-message", {
			cliSessionId: "cli-1",
			input: "diff",
			model: "mistral/ministral-3b",
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.quota.remaining).toBe(3);
		expect(body.output).toBe("feat: commit");
	});

	it("streams commit message with usage and provider-metadata order", async () => {
		const app = createApiApp(
			createDeps({
				getUserBillingInfo: async () => ({
					plan: "free",
					balance: 10,
					meterId: "meter",
				}),
			}),
		);
		const response = await request(app, "/api/v1/commit-message/stream", {
			cliSessionId: "cli-1",
			input: "diff",
			model: "mistral/ministral-3b",
		});
		const text = await response.text();
		const events = text
			.split("\n\n")
			.map((entry) => entry.trim())
			.filter(Boolean)
			.map((entry) => JSON.parse(entry.replace(/^data:\s*/, "")));

		expect(events.map((event) => event.type)).toEqual([
			"commit-message",
			"usage",
			"provider-metadata",
		]);
		expect(events[0].commitMessage).toBe("feat: done");
		expect(events[1].usage.inputTokens).toBe(3);
		expect(events[2].providerMetadata.model).toBe("model-a");
	});

	it("returns 401 for unauthenticated pr route", async () => {
		const app = createApiApp(
			createDeps({
				getAuth: () => withAuth(true),
			}),
		);
		const response = await request(app, "/api/v1/pr-title-body", {
			cliSessionId: "cli-1",
			input: "diff",
			model: "mistral/ministral-3b",
		});
		const body = await response.json();
		expect(response.status).toBe(401);
		expect(body).toEqual(unauthorizedBody);
	});

	for (const path of ["/api/v1/pr-title-body", "/api/v1/pr-intent"]) {
		it(`validates model for ${path}`, async () => {
			const app = createApiApp(createDeps());
			const response = await request(app, path, {
				cliSessionId: "cli-1",
				input: "diff",
				model: "invalid-model",
			});
			const body = await response.json();
			expect(response.status).toBe(400);
			expect(body.error).toBe("invalid_model");
		});

		it(`returns 200 for ${path}`, async () => {
			const app = createApiApp(createDeps());
			const response = await request(app, path, {
				cliSessionId: "cli-1",
				input: "diff",
				model: "mistral/ministral-3b",
			});
			const body = await response.json();
			expect(response.status).toBe(200);
			expect(body.generationId).toBeTruthy();
		});
	}

	it("returns 401 for generation score without auth", async () => {
		const app = createApiApp(
			createDeps({
				getAuth: () => withAuth(true),
			}),
		);
		const response = await request(app, "/api/v1/generation_score", {
			generationId: "abc",
			value: 1,
		});
		const body = await response.json();
		expect(response.status).toBe(401);
		expect(body).toEqual(unauthorizedBody);
	});

	it("returns 404 for missing generation score target", async () => {
		const deps = createDeps({
			storage: {
				...createStorage(),
				findGenerationByGenerationIdAndUserId: async () => undefined,
				insertGeneration: async () => {},
				findCommandExecutionId: async () => 11,
			},
		});
		const app = createApiApp(deps);
		const response = await request(app, "/api/v1/generation_score", {
			generationId: "abc",
			value: 1,
		});
		const body = await response.json();
		expect(response.status).toBe(404);
		expect(body.error).toBe("Generation not found");
	});

	it("stores generation score and returns ok", async () => {
		const storage = createStorage();
		const app = createApiApp(createDeps({ storage }));
		const response = await request(app, "/api/v1/generation_score", {
			generationId: "abc",
			value: 1,
		});
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body).toEqual({ ok: true });
		expect(storage.insertedGenerationScore).toBe(true);
	});

	it("serves health endpoint", async () => {
		const app = createApiApp(createDeps());
		const response = await request(app, "/api/health", undefined, "GET");
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.status).toBe("ok");
	});
});
