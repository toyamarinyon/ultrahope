import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.default(false)
		.notNull(),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const deviceCode = sqliteTable("device_code", {
	id: text("id").primaryKey(),
	deviceCode: text("device_code").notNull(),
	userCode: text("user_code").notNull(),
	userId: text("user_id"),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	status: text("status").notNull(),
	lastPolledAt: integer("last_polled_at", { mode: "timestamp_ms" }),
	pollingInterval: integer("polling_interval"),
	clientId: text("client_id"),
	scope: text("scope"),
});

export const freePlanDailyUsage = sqliteTable(
	"free_plan_daily_usage",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		date: text("date").notNull(), // 'YYYY-MM-DD' in UTC
		count: integer("count").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.date] }),
		// Keep for fast cleanup/aggregation by date; remove if unused.
		index("free_plan_daily_usage_date_idx").on(table.date),
	],
);

export const commandExecution = sqliteTable(
	"command_execution",
	{
		id: text("id").primaryKey(),
		cliSessionId: text("cli_session_id").notNull(),
		userId: text("user_id")
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
		id: text("id").primaryKey(),
		commandExecutionId: text("command_execution_id")
			.notNull()
			.references(() => commandExecution.id, { onDelete: "cascade" }),
		vercelAiGatewayGenerationId: text(
			"vercel_ai_gateway_generation_id",
		).notNull(),
		providerName: text("provider_name").notNull(),
		model: text("model").notNull(),
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

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));
