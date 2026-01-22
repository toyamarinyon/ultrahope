import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl) {
	throw new Error("Missing DATABASE_URL for drizzle-kit.");
}

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./db/migrations",
	dialect: "turso",
	dbCredentials: { url: databaseUrl, authToken },
});
