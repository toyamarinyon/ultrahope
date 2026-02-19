import { Elysia } from "elysia";
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

export function createCommandExecutionRoutes(deps: ApiDependencies): Elysia {
	return new Elysia().post(
		"/v1/command_execution",
		async ({ body, session, set, db }: any) => {
			if (!session) {
				set.status = 401;
				return unauthorizedBody;
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
