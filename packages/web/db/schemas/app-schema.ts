import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { LanguageModel } from "@/lib/llm/types";
import { user } from "./auth-schema";

export const commandExecution = sqliteTable(
	"command_execution",
	{
		id: integer("id", { mode: "number" }).primaryKey({
			autoIncrement: true,
		}),
		cliSessionId: text("cli_session_id").notNull(),
		userId: integer("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		command: text("command").notNull(),
		args: text("args").notNull(),
		api: text("api").notNull(),
		requestPayload: text("request_payload", { mode: "json" }),
		startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
		finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("command_execution_command_idx").on(table.command),
		index("command_execution_started_at_idx").on(table.startedAt),
		index("command_execution_finished_at_idx").on(table.finishedAt),
	],
);

export const generation = sqliteTable(
	"generation",
	{
		id: integer("id", { mode: "number" }).primaryKey({
			autoIncrement: true,
		}),
		commandExecutionId: integer("command_execution_id")
			.notNull()
			.references(() => commandExecution.id, { onDelete: "cascade" }),
		vercelAiGatewayGenerationId: text(
			"vercel_ai_gateway_generation_id",
		).notNull(),
		providerName: text("provider_name").notNull(),
		model: text("model").$type<LanguageModel>().notNull(),
		cost: integer("cost").notNull(),
		latency: integer("latency").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		gatewayPayload: text("gateway_payload", { mode: "json" }),
		output: text("output").notNull(),
	},
	(table) => [
		uniqueIndex("generation_gateway_id_unique").on(
			table.vercelAiGatewayGenerationId,
		),
		index("generation_model_idx").on(table.model),
		index("generation_started_at_idx").on(table.createdAt),
	],
);

export const generationScore = sqliteTable(
	"generation_score",
	{
		id: integer("id", { mode: "number" }).primaryKey({
			autoIncrement: true,
		}),
		generationId: integer("generation_id")
			.notNull()
			.references(() => generation.id, { onDelete: "cascade" }),
		value: integer("value").notNull(),
		comment: text("comment"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("generation_score_generation_id_idx").on(table.generationId),
	],
);
