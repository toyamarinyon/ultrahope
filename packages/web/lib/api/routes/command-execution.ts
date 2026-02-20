import { Elysia } from "elysia";
import type { Db } from "@/db/client";
import type { ApiDependencies } from "../dependencies";
import { unauthorizedBody } from "../shared/errors";
import {
	enforceDailyLimitOr402,
	enforceProBalanceOr402,
} from "../shared/usage-guard";
import {
	CommandExecutionBodySchema,
	CommandExecutionResponseSchemas,
} from "../shared/validators";

type ApiSession = {
	user: {
		id: number;
	};
};

type CommandExecutionRouteContext = {
	body: {
		commandExecutionId: string;
		cliSessionId: string;
		command: string;
		args: string[];
		api: string;
		requestPayload: {
			input: string;
			target: "vcs-commit-message" | "pr-title-body" | "pr-intent";
			model?: string;
			models?: string[];
			hint?: string;
		};
	};
	session?: ApiSession;
	db?: Db;
	request: Request;
	set: {
		status?: number | string;
	};
};

export function createCommandExecutionRoutes(deps: ApiDependencies): Elysia {
	return new Elysia().post(
		"/v1/command_execution",
		async ({ body, session, set, db }: CommandExecutionRouteContext) => {
			if (!session) {
				set.status = 401;
				return unauthorizedBody;
			}
			if (!db) {
				set.status = 500;
				return { error: "Database unavailable" };
			}

			const generationAbortController = new AbortController();
			const billingInfo = await deps.getUserBillingInfo(session.user.id, {
				throwOnError: true,
			});
			const plan = billingInfo?.plan ?? "free";

			const dailyLimitResult = await enforceDailyLimitOr402(
				{
					assertDailyLimitNotExceeded: deps.assertDailyLimitNotExceeded,
					baseUrl: deps.baseUrl,
				},
				{
					db,
					userId: session.user.id,
					plan,
					generationAbortController,
					set,
				},
			);
			if (dailyLimitResult) {
				return dailyLimitResult.errorBody;
			}

			const balanceResult = enforceProBalanceOr402(
				{
					baseUrl: deps.baseUrl,
				},
				{
					plan,
					billingInfo,
					generationAbortController,
					set,
				},
			);
			if (balanceResult) {
				return balanceResult.errorBody;
			}

			await deps.storage.insertCommandExecution({
				db,
				cliSessionId: body.cliSessionId,
				userId: session.user.id,
				command: body.command,
				args: JSON.stringify(body.args),
				api: body.api,
				requestPayload: body.requestPayload,
				startedAt: new Date(),
			});

			return { commandExecutionId: body.commandExecutionId };
		},
		{
			body: CommandExecutionBodySchema,
			response: CommandExecutionResponseSchemas,
			detail: {
				summary: "Create a command execution record",
				tags: ["command_execution"],
				security: [{ bearerAuth: [] }],
			},
		},
	) as unknown as Elysia;
}
