import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./db/migrations",
	dialect: "turso",
	dbCredentials: { url: databaseUrl ?? "", authToken },
});
