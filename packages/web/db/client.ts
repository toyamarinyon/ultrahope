import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { authRelations } from "./relations/auth-relations";
import * as schema from "./schemas";

const client = createClient({
	url: process.env.TURSO_DATABASE_URL ?? "",
	authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle({
	client,
	schema,
	relations: {
		...authRelations,
	},
});
