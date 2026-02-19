import type { LanguageModelUsage, ProviderMetadata } from "ai";
import type { Db } from "@/db/client";
import { buildResponse } from "@/lib/llm/llm-utils";
import type { LLMResponse } from "@/lib/llm/types";
import {
	createInsufficientBalanceBody,
	type InsufficientBalanceBody,
} from "./errors";
import type { ApiStorage } from "./storage";

export type GenerateContext = {
	userId: number;
	cliSessionId: string;
	model: string;
	abortSignal: AbortSignal;
	db: Db;
};

export type ExecuteGenerationResult =
	| {
			success: true;
			response: LLMResponse & { output: string };
			quota?: { remaining: number; limit: number; resetsAt: string };
	  }
	| {
			success: false;
			status: 402;
			body: InsufficientBalanceBody;
	  };

export type GenerationServiceDeps = {
	getUserBillingInfo: (externalCustomerId: number) => Promise<{
		balance: number;
		plan: "free" | "pro";
	} | null>;
	getDailyUsageInfo: (
		db: Db,
		userId: number,
	) => Promise<{
		remaining: number;
		limit: number;
		resetsAt: Date;
	}>;
	storage: ApiStorage;
	baseUrl: string;
	microDollarsPerUsd: number;
	getPolarClient: () => {
		events: {
			ingest: (...args: any[]) => Promise<unknown>;
		};
	};
};

type LLMGenerator = (abortSignal: AbortSignal) => Promise<LLMResponse>;

export async function executeGeneration(
	ctx: GenerateContext,
	generateFn: LLMGenerator,
	deps: GenerationServiceDeps,
	startedAt = Date.now(),
): Promise<ExecuteGenerationResult> {
	const billingInfo = await deps.getUserBillingInfo(ctx.userId);
	const plan = billingInfo?.plan ?? "free";

	if (plan === "pro" && billingInfo && billingInfo.balance <= 0) {
		return {
			success: false,
			status: 402,
			body: createInsufficientBalanceBody(
				{
					balance: billingInfo.balance,
					plan: billingInfo.plan,
				},
				deps.baseUrl,
			),
		};
	}

	const [response, commandExecutionId] = await Promise.all([
		generateFn(ctx.abortSignal),
		deps.storage.findCommandExecutionId({
			db: ctx.db,
			cliSessionId: ctx.cliSessionId,
			userId: ctx.userId,
		}),
	]);

	const costInMicrodollars = response.cost
		? Math.round(response.cost * deps.microDollarsPerUsd)
		: 0;

	if (response.generationId) {
		ingestUsageEvent({
			getPolarClient: deps.getPolarClient,
			userId: ctx.userId,
			costInMicrodollars,
			model: response.model,
			vendor: response.vendor,
			generationId: response.generationId,
		});

		if (commandExecutionId) {
			void deps.storage.insertGeneration({
				db: ctx.db,
				commandExecutionId,
				vercelAiGatewayGenerationId: response.generationId,
				providerName: response.vendor,
				model: response.model,
				cost: costInMicrodollars,
				latency: Date.now() - startedAt,
				createdAt: new Date(),
				gatewayPayload: response.gatewayPayload ?? null,
				output: response.content,
			});
		} else {
			console.warn(
				"[usage] Missing commandExecutionId for cliSessionId:",
				ctx.cliSessionId,
			);
		}
	}

	const result: ExecuteGenerationResult = {
		success: true,
		response: { output: response.content, ...response },
	};

	if (plan === "free") {
		const usageInfo = await deps.getDailyUsageInfo(ctx.db, ctx.userId);
		result.quota = {
			remaining: usageInfo.remaining,
			limit: usageInfo.limit,
			resetsAt: usageInfo.resetsAt.toISOString(),
		};
	}

	return result;
}

export async function finalizeStreamingGeneration(
	stream: {
		textStream?: AsyncIterable<string>;
		totalUsage: PromiseLike<LanguageModelUsage>;
		providerMetadata: PromiseLike<ProviderMetadata | undefined>;
	},
	args: {
		ctx: GenerateContext;
		model: string;
		responseText: string;
		startedAt: number;
		storage: ApiStorage;
		db: Db;
		baseUrl: string;
		microDollarsPerUsd: number;
		getPolarClient: GenerationServiceDeps["getPolarClient"];
	},
): Promise<{
	usage: {
		inputTokens: number;
		outputTokens: number;
	};
	providerMetadata: ProviderMetadata | undefined;
}> {
	const [usage, providerMetadata] = await Promise.all([
		stream.totalUsage,
		stream.providerMetadata,
	]);

	const response = buildResponse(
		{
			text: args.responseText,
			usage: {
				inputTokens: usage.inputTokens ?? 0,
				outputTokens: usage.outputTokens ?? 0,
			},
			providerMetadata,
		},
		args.model,
	);

	const costInMicrodollars = response.cost
		? Math.round(response.cost * args.microDollarsPerUsd)
		: 0;

	if (response.generationId) {
		ingestUsageEvent({
			getPolarClient: args.getPolarClient,
			userId: args.ctx.userId,
			costInMicrodollars,
			model: response.model,
			vendor: response.vendor,
			generationId: response.generationId,
		});

		const commandExecutionId = await args.storage.findCommandExecutionId({
			db: args.db,
			cliSessionId: args.ctx.cliSessionId,
			userId: args.ctx.userId,
		});

		if (commandExecutionId) {
			await args.storage.insertGeneration({
				db: args.db,
				commandExecutionId,
				vercelAiGatewayGenerationId: response.generationId,
				providerName: response.vendor,
				model: response.model,
				cost: costInMicrodollars,
				latency: Date.now() - args.startedAt,
				createdAt: new Date(),
				gatewayPayload: response.gatewayPayload ?? null,
				output: response.content,
			});
		} else {
			console.warn(
				"[usage] Missing commandExecutionId for cliSessionId:",
				args.ctx.cliSessionId,
			);
		}
	} else {
		console.warn("[usage] Missing generationId; skipping generation insert.");
	}

	return {
		usage: {
			inputTokens: usage.inputTokens ?? 0,
			outputTokens: usage.outputTokens ?? 0,
		},
		providerMetadata,
	};
}

export function ingestUsageEvent(args: {
	getPolarClient: GenerationServiceDeps["getPolarClient"];
	userId: number;
	costInMicrodollars: number;
	model: string;
	vendor: string;
	generationId: string;
}) {
	if (args.costInMicrodollars <= 0) return;

	const polarClient = args.getPolarClient();
	polarClient.events
		.ingest({
			events: [
				{
					name: "usage",
					externalCustomerId: args.userId.toString(),
					metadata: {
						cost: args.costInMicrodollars,
						model: args.model,
						provider: args.vendor,
						generationId: args.generationId,
					},
				},
			],
		})
		.catch((error) => {
			console.error("[polar] Failed to ingest usage event:", error);
		});
}
