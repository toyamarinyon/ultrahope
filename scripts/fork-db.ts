/**
 * This script is the operational implementation for the mitigation documented in
 * `.workspace-fs/tasks/active/polar-external-id-collision-investigation.md`:
 * fork branch DBs, apply a randomized user sequence offset, and upsert Preview
 * environment variables to avoid `polar.external_id` collisions across branches.
 */
import { randomInt } from "node:crypto";
import { createClient as createLibSqlClient } from "@libsql/client";
import {
	type CreatedDatabase,
	createClient,
	type DatabaseToken,
} from "@tursodatabase/api";
import { Vercel } from "@vercel/sdk";

type CommandArgs = {
	branchName: string;
	parentDbName?: string;
	projectId?: string;
	projectName?: string;
	offsetMin: number;
	offsetMax: number;
	dryRun: boolean;
};

type TursoDatabasesClient = {
	create: (
		name: string,
		options: Record<string, unknown>,
	) => Promise<CreatedDatabase>;
	createToken: (name: string) => Promise<DatabaseToken>;
};

const DEFAULT_OFFSET_MIN = 1_000_000;
const DEFAULT_OFFSET_MAX = 10_000_000;

const MAX_OFFSET_SAFE = 0x7fffffff;

function formatUsage(): never {
	console.error(`Usage:
  bun scripts/fork-db.ts <branch-name> [--parent-db-name <name>] [--project-id <id>] [--project-name <name>] [--dry-run] [--offset-min <n>] [--offset-max <n>]

Required env:
  TURSO_API_TOKEN          token for @tursodatabase/api
  TURSO_ORG                Turso organization slug
  VERCEL_TOKEN             Vercel API token
  TURSO_DATABASE_URL       parent DB URL (fallback parent DB name)
  VERCEL_PROJECT_ID or VERCEL_PROJECT_NAME
`);
	process.exit(1);
}

function parseOffsetArg(value: string | undefined, argName: string): number {
	if (!value) {
		console.error(`${argName} requires a value.`);
		formatUsage();
	}
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_OFFSET_SAFE) {
		console.error(
			`${argName} must be a positive integer not greater than ${MAX_OFFSET_SAFE}.`,
		);
		formatUsage();
	}
	return parsed;
}

function parseArgs(argv: string[]): CommandArgs {
	if (argv.length === 0) {
		formatUsage();
	}

	const parsed: CommandArgs = {
		branchName: "",
		offsetMin: DEFAULT_OFFSET_MIN,
		offsetMax: DEFAULT_OFFSET_MAX,
		dryRun: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === "--dry-run") {
			parsed.dryRun = true;
			continue;
		}

		if (arg === "--parent-db-name") {
			parsed.parentDbName = argv[index + 1];
			if (!parsed.parentDbName) {
				console.error("--parent-db-name requires a value.");
				formatUsage();
			}
			index += 1;
			continue;
		}

		if (arg === "--project-id") {
			parsed.projectId = argv[index + 1];
			if (!parsed.projectId) {
				console.error("--project-id requires a value.");
				formatUsage();
			}
			index += 1;
			continue;
		}

		if (arg === "--project-name") {
			parsed.projectName = argv[index + 1];
			if (!parsed.projectName) {
				console.error("--project-name requires a value.");
				formatUsage();
			}
			index += 1;
			continue;
		}

		if (arg === "--offset-min") {
			parsed.offsetMin = parseOffsetArg(argv[index + 1], "--offset-min");
			index += 1;
			continue;
		}

		if (arg === "--offset-max") {
			parsed.offsetMax = parseOffsetArg(argv[index + 1], "--offset-max");
			index += 1;
			continue;
		}

		if (arg.startsWith("--offset-min=")) {
			parsed.offsetMin = parseOffsetArg(
				arg.slice("--offset-min=".length),
				"--offset-min",
			);
			continue;
		}

		if (arg.startsWith("--offset-max=")) {
			parsed.offsetMax = parseOffsetArg(
				arg.slice("--offset-max=".length),
				"--offset-max",
			);
			continue;
		}

		if (arg.startsWith("-")) {
			console.error(`Unknown flag: ${arg}`);
			formatUsage();
		}

		if (parsed.branchName) {
			console.error("Too many positional arguments.");
			formatUsage();
		}
		parsed.branchName = arg;
	}

	if (!parsed.branchName) {
		console.error("Missing branch-name.");
		formatUsage();
	}

	if (parsed.offsetMin >= parsed.offsetMax) {
		console.error("--offset-min must be smaller than --offset-max.");
		formatUsage();
	}

	return parsed;
}

function sanitizeName(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/\//g, "-")
		.replace(/[^a-z0-9@-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || "branch";
}

function requireEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`Missing required env: ${name}`);
	}
	return value;
}

function requireTursoOrg(): string {
	return requireEnv("TURSO_ORG");
}

function getProjectIdentifier(args: CommandArgs): string {
	const projectId = args.projectId ?? process.env.VERCEL_PROJECT_ID;
	if (projectId) return projectId;

	const projectName = args.projectName ?? process.env.VERCEL_PROJECT_NAME;
	if (projectName) return projectName;

	throw new Error(
		"Missing project identifier: set --project-id/--project-name or VERCEL_PROJECT_ID/VERCEL_PROJECT_NAME.",
	);
}

function inferParentDbNameFromParentUrl(parentUrl: string): string {
	try {
		const parsed = new URL(parentUrl);
		const firstSegment = parsed.hostname.split(".")[0];
		if (!firstSegment) {
			throw new Error(
				"Unable to infer parent DB name from TURSO_DATABASE_URL.",
			);
		}
		return sanitizeName(firstSegment);
	} catch {
		throw new Error("Unable to infer parent DB name from TURSO_DATABASE_URL.");
	}
}

function buildForkName(parentDbName: string, branchSafe: string): string {
	return `${parentDbName}-${branchSafe}`;
}

function makeOffset(min: number, max: number): number {
	return randomInt(min, max + 1);
}

function normalizeForkUrl(
	response: unknown,
	parentUrl: string,
	forkName: string,
	fallbackHostSegment = "turso",
) {
	if (response && typeof response === "object") {
		const direct = response as {
			url?: string;
			database?: { url?: string };
			primaryDatabase?: { url?: string };
			dbUrl?: string;
		};
		const candidates = [
			direct.url,
			direct.dbUrl,
			direct.database?.url,
			direct.primaryDatabase?.url,
		];

		for (const candidate of candidates) {
			if (typeof candidate === "string" && candidate.startsWith("libsql://")) {
				return candidate;
			}
		}
	}

	const parsed = new URL(parentUrl);
	const segments = parsed.hostname.split(".");
	if (segments.length > 1) {
		const host = [forkName, ...segments.slice(1)].join(".");
		return `${parsed.protocol}//${host}${parsed.pathname}`;
	}

	return `${parsed.protocol}//${forkName}.${fallbackHostSegment}${parsed.pathname}`;
}

type CreateFork = {
	response?: CreatedDatabase;
	existed: boolean;
};

async function createFork(
	databases: TursoDatabasesClient,
	forkName: string,
	parentDbName: string,
): Promise<CreateFork> {
	try {
		const response = await databases.create(forkName, {
			seed: {
				type: "database",
				name: parentDbName,
			},
		});
		return { response, existed: false };
	} catch (error) {
		const message = String((error as Error).message ?? error).toLowerCase();
		if (
			message.includes("already exists") ||
			message.includes("already exist") ||
			message.includes("409")
		) {
			return { response: undefined, existed: true };
		}
		throw error;
	}
}

async function createForkToken(
	databases: TursoDatabasesClient,
	forkName: string,
): Promise<string> {
	const tokenResponse = await databases.createToken(forkName);
	if (typeof tokenResponse.jwt !== "string" || tokenResponse.jwt.length === 0) {
		throw new Error("Unable to extract token from createToken response.");
	}
	return tokenResponse.jwt;
}

async function setSequenceOffset(
	databaseUrl: string,
	token: string,
	offset: number,
): Promise<void> {
	const client = createLibSqlClient({ url: databaseUrl, authToken: token });
	try {
		const sql =
			"INSERT INTO sqlite_sequence(name, seq) VALUES('user', ?) ON CONFLICT(name) DO UPDATE SET seq = seq + excluded.seq;";
		await client.execute({ sql, args: [offset] });
	} finally {
		client.close();
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const branchSafe = sanitizeName(args.branchName);
	const parentDbName = args.parentDbName
		? sanitizeName(args.parentDbName)
		: inferParentDbNameFromParentUrl(requireEnv("TURSO_DATABASE_URL"));
	const forkName = buildForkName(parentDbName, branchSafe);
	const offset = makeOffset(args.offsetMin, args.offsetMax);

	const projectIdentifier = args.dryRun
		? (args.projectId ??
			args.projectName ??
			process.env.VERCEL_PROJECT_ID ??
			process.env.VERCEL_PROJECT_NAME ??
			"")
		: getProjectIdentifier(args);

	const parentUrl = process.env.TURSO_DATABASE_URL;

	if (args.dryRun) {
		console.log("DRY RUN: no API calls will be executed.");
		console.log("Inputs:");
		console.log(`  branch-name = ${args.branchName}`);
		console.log(`  branch-safe = ${branchSafe}`);
		console.log(`  parent-db-name = ${parentDbName}`);
		console.log(`  fork-name = ${forkName}`);
		console.log(`  branch offset range = ${args.offsetMin}..${args.offsetMax}`);
		console.log(`  chosen offset = ${offset}`);
		console.log(`  vercel-project = ${projectIdentifier || "N/A"}`);
		console.log(
			`  turso-fork-url = ${parentUrl ? normalizeForkUrl({}, parentUrl, forkName) : "N/A"}`,
		);
		console.log("  vercel env keys:");
		console.log("    - TURSO_DATABASE_URL");
		console.log("    - TURSO_AUTH_TOKEN");
		return;
	}

	const tursoApiToken = requireEnv("TURSO_API_TOKEN");
	const tursoDatabaseUrl = requireEnv("TURSO_DATABASE_URL");
	const vercelToken = requireEnv("VERCEL_TOKEN");

	console.log(`Creating Turso fork ${forkName} with parent ${parentDbName}...`);
	let forkResult: CreateFork;
	let forkToken: string;
	const turso = createClient({
		token: tursoApiToken,
		org: requireTursoOrg(),
	});
	try {
		forkResult = await createFork(turso.databases, forkName, parentDbName);
		if (forkResult.existed) {
			console.log(`Info: fork already exists, reusing "${forkName}".`);
		}
	} catch (error) {
		console.error("Error: failed to create fork.");
		throw error;
	}

	const forkUrl = normalizeForkUrl(
		forkResult.response,
		tursoDatabaseUrl,
		forkName,
	);

	try {
		forkToken = await createForkToken(turso.databases, forkName);
		console.log("Fork token created.");
	} catch (error) {
		console.error("Error: fork was created, but token creation failed.");
		console.error(`Fork: ${forkName}`);
		console.error(`Fork URL (guessed): ${forkUrl}`);
		throw error;
	}

	try {
		await setSequenceOffset(forkUrl, forkToken, offset);
		console.log(`Updated sqlite_sequence.user by +${offset}.`);
	} catch (error) {
		console.error(
			"Error: fork is created, but failed to apply sqlite_sequence offset.",
		);
		console.error(
			"Suggested action: either rollback the fork manually or rerun after manually fixing user sequence.",
		);
		throw error;
	}

	try {
		const vercel = new Vercel({ bearerToken: vercelToken });
		await vercel.projects.createProjectEnv({
			idOrName: projectIdentifier,
			upsert: "true",
			requestBody: {
				key: "TURSO_DATABASE_URL",
				value: forkUrl,
				type: "sensitive",
				target: ["preview"],
				gitBranch: args.branchName,
			},
		});
		await vercel.projects.createProjectEnv({
			idOrName: projectIdentifier,
			upsert: "true",
			requestBody: {
				key: "TURSO_AUTH_TOKEN",
				value: forkToken,
				type: "sensitive",
				target: ["preview"],
				gitBranch: args.branchName,
			},
		});
	} catch (error) {
		console.error("Error: SQL update succeeded, but Vercel env upsert failed.");
		console.error(`Fork: ${forkName}`);
		console.error(`URL: ${forkUrl}`);
		const retryArg =
			args.projectId || process.env.VERCEL_PROJECT_ID
				? "--project-id"
				: "--project-name";
		console.error(
			`Run again to retry env sync: bun scripts/fork-db.ts ${args.branchName} --parent-db-name ${parentDbName} ${retryArg} ${projectIdentifier}`,
		);
		throw error;
	}

	console.log("");
	console.log("Created fork:");
	console.log(`  name: ${forkName}`);
	console.log(`  url: ${forkUrl}`);
	console.log(`  token: [redacted in output]`);
	console.log(`  sqlite_sequence offset: +${offset}`);
	console.log("");
	console.log("Run this command next:");
	console.log(
		`bun x vercel env pull --cwd packages/web --git-branch ${args.branchName} --environment preview`,
	);
}

main().catch((error) => {
	if (
		error &&
		typeof error === "object" &&
		"message" in (error as { message?: string })
	) {
		console.error(`\n${(error as { message: string }).message}`);
	}
	process.exitCode = 1;
});
