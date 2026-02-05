import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { authRelations } from "./relations/auth-relations";
import * as schema from "./schemas";

export type Db = ReturnType<typeof makeDb>;

let cachedDb: Db | null = null;

function makeClient() {
	return createClient({
		url: process.env.TURSO_DATABASE_URL ?? "",
		authToken: process.env.TURSO_AUTH_TOKEN,
	});
}

export function makeDb() {
	const client = makeClient();
	return drizzle({
		client,
		schema,
		relations: {
			...authRelations,
		},
	});
}

export function getDb(): Db {
	if (!cachedDb) {
		cachedDb = makeDb();
	}
	return cachedDb;
}
