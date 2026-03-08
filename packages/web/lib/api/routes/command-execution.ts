import { Elysia } from "elysia";
import type { Db } from "@/db/client";
import type { ApiDependencies } from "../dependencies";
import { unauthorizedBody } from "../shared/errors";
import {
	enforceAnonymousTrialOr402,
	enforceDailyLimitOr402,
	enforceInputLengthLimitOr400,
	enforceProBalanceOr402,
	FREE_INPUT_LENGTH_LIMIT,
	getBillingInfoOr503,
} from "../shared/usage-guard";
import {
	CommandExecutionBodySchema,
	CommandExecutionResponseSchemas,
} from "../shared/validators";

type ApiSession = {
	user: {
		id: number;
		isAnonymous: boolean;
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
			guide?: string;
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
			if (session.user.isAnonymous) {
				const inputLengthResult = enforceInputLengthLimitOr400({
					plan: "free",
					input: body.requestPayload.input,
					limit: FREE_INPUT_LENGTH_LIMIT,
					set,
				});
				if (inputLengthResult) {
					return inputLengthResult.errorBody;
				}

				const anonymousTrialResult = await enforceAnonymousTrialOr402(
					{
						assertAnonymousTrialNotExceeded:
							deps.assertAnonymousTrialNotExceeded,
						baseUrl: deps.baseUrl,
					},
					{
						db,
						userId: session.user.id,
						generationAbortController,
						set,
					},
				);
				if (anonymousTrialResult) {
					return anonymousTrialResult.errorBody;
				}
			} else {
				const billingInfoResult = await getBillingInfoOr503({
					userId: session.user.id,
					getUserBillingInfo: (userId) =>
						deps.getUserBillingInfo(userId, { throwOnError: true }),
					set,
					generationAbortController,
				});
				if (billingInfoResult.status === 503) {
					return billingInfoResult.errorBody;
				}
				const { billingInfo, plan } = billingInfoResult;

				const inputLengthResult = enforceInputLengthLimitOr400({
					plan,
					input: body.requestPayload.input,
					limit: FREE_INPUT_LENGTH_LIMIT,
					set,
				});
				if (inputLengthResult) {
					return inputLengthResult.errorBody;
				}

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
