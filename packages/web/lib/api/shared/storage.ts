import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { commandExecution, generation, generationScore } from "@/db/schemas";

type GenerationInsertArgs = {
	commandExecutionId: number;
	vercelAiGatewayGenerationId: string;
	providerName: string;
	model: string;
	cost: number;
	latency: number;
	createdAt: Date;
	gatewayPayload: unknown;
	output: string;
};

export type ApiStorage = {
	insertCommandExecution: (args: {
		db: Db;
		cliSessionId: string;
		userId: number;
		command: string;
		args: string;
		api: string;
		requestPayload: Record<string, unknown>;
		startedAt: Date;
	}) => Promise<void>;

	findCommandExecutionId: (args: {
		db: Db;
		cliSessionId: string;
		userId: number;
	}) => Promise<number | undefined>;

	insertGeneration: (
		args: {
			db: Db;
		} & GenerationInsertArgs,
	) => Promise<void>;

	insertGenerationScore: (args: {
		db: Db;
		generationId: number;
		value: number;
		createdAt: Date;
	}) => Promise<void>;

	findGenerationByGenerationIdAndUserId: (args: {
		db: Db;
		generationId: string;
		userId: number;
	}) => Promise<number | undefined>;
};

export function createDefaultApiStorage(): ApiStorage {
	return {
		async insertCommandExecution({
			db,
			cliSessionId,
			userId,
			command,
			args,
			api,
			requestPayload,
			startedAt,
		}) {
			await db
				.insert(commandExecution)
				.values({
					cliSessionId,
					userId,
					command,
					args,
					api,
					requestPayload: JSON.stringify(requestPayload),
					startedAt,
					finishedAt: null,
				})
				.onConflictDoNothing();
		},
		async findCommandExecutionId({ db, cliSessionId, userId }) {
			const commandExecutionRow = await db
				.select({ id: commandExecution.id })
				.from(commandExecution)
				.where(
					and(
						eq(commandExecution.cliSessionId, cliSessionId),
						eq(commandExecution.userId, userId),
					),
				)
				.limit(1);
			return commandExecutionRow[0]?.id;
		},
		async insertGeneration({
			db,
			commandExecutionId,
			vercelAiGatewayGenerationId,
			providerName,
			model,
			cost,
			latency,
			createdAt,
			gatewayPayload,
			output,
		}) {
			await db.insert(generation).values({
				commandExecutionId,
				vercelAiGatewayGenerationId,
				providerName,
				model,
				cost,
				latency,
				createdAt,
				gatewayPayload,
				output,
			});
		},
		async insertGenerationScore({ db, generationId, value, createdAt }) {
			await db.insert(generationScore).values({
				generationId,
				value,
				createdAt,
			});
		},
		async findGenerationByGenerationIdAndUserId({ db, generationId, userId }) {
			const rows = await db
				.select({ generationId: generation.id })
				.from(generation)
				.innerJoin(
					commandExecution,
					eq(generation.commandExecutionId, commandExecution.id),
				)
				.where(
					and(
						eq(generation.vercelAiGatewayGenerationId, generationId),
						eq(commandExecution.userId, userId),
					),
				)
				.limit(1);
			return rows[0]?.generationId;
		},
	};
}
