import { Elysia } from "elysia";
import type { Db } from "@/db/client";
import { getModelTier } from "@/lib/llm/models";
import type { ApiDependencies } from "../dependencies";
import {
	createSubscriptionRequiredBody,
	unauthorizedBody,
} from "../shared/errors";
import {
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
		installationId: string;
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

function getRequestedModels(payload: {
	model?: string;
	models?: string[];
}): string[] {
	if (payload.models && payload.models.length > 0) {
		return payload.models;
	}
	if (payload.model) {
		return [payload.model];
	}
	return [];
}

function hasProModel(models: string[]): boolean {
	return models.some((model) => getModelTier(model) === "pro");
}

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
			const billingInfoResult = await getBillingInfoOr503({
				userId: session.user.id,
				isAnonymous: session.user.isAnonymous,
				getUserBillingInfo: (userId) =>
					deps.getUserBillingInfo(userId, { throwOnError: true }),
				baseUrl: deps.baseUrl,
				set,
				generationAbortController,
			});
			if (billingInfoResult.status === 402) {
				return billingInfoResult.errorBody;
			}
			if (billingInfoResult.status === 503) {
				return billingInfoResult.errorBody;
			}
			const { billingInfo, plan } = billingInfoResult;
			if (
				hasProModel(getRequestedModels(body.requestPayload)) &&
				plan !== "pro"
			) {
				set.status = 402;
				return createSubscriptionRequiredBody(deps.baseUrl);
			}

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
					installationId: body.installationId,
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
				installationId: body.installationId,
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
