import { Polar } from "@polar-sh/sdk";
import { and, eq, inArray } from "drizzle-orm";
import {
	account,
	commandExecution,
	deviceCode,
	generation,
	generationScore,
	getDb,
	session,
	user,
} from "../db";

type Mode = "dry-run" | "execute";
type ResultStatus = "success" | "failed" | "skipped";

type ActionResult = {
	status: ResultStatus;
	target: string;
	detail?: string;
};

type DeleteUserReport = {
	mode: Mode;
	email: string;
	userFound: boolean;
	userId?: number;
	planned: {
		sessions: number;
		accounts: number;
		githubAccounts: number;
		githubAccountsWithoutAccessToken: number;
		deviceCodes: number;
		commandExecutions: number;
		generations: number;
		generationScores: number;
		polarCustomers: number;
	};
	actions: {
		githubRevokes: ActionResult[];
		polarDeletes: ActionResult[];
		dbDelete?: ActionResult;
	};
	summary: {
		externalFailures: number;
		fatalFailure: boolean;
	};
};

type ParsedArgs = {
	email: string;
	mode: Mode;
	confirm?: string;
	json: boolean;
};

const REQUIRED_ENV_VARS = [
	"TURSO_DATABASE_URL",
	"TURSO_AUTH_TOKEN",
	"POLAR_ACCESS_TOKEN",
	"GITHUB_CLIENT_ID",
	"GITHUB_CLIENT_SECRET",
] as const;

const HELP_TEXT = `
Delete user data for account-deletion operations (GDPR/CCPA manual workflow).

Usage:
  bun scripts/delete-user.ts --email <email> --dry-run
  bun scripts/delete-user.ts --email <email> --execute --confirm <email>

Options:
  --email <email>     Target user email (required)
  --dry-run           Show planned actions only (default)
  --execute           Execute deletion flow
  --confirm <email>   Required with --execute, must exactly match --email
  --json              Output result as JSON
  --help              Show this help
`.trim();

function parseArgs(argv: string[]): ParsedArgs {
	if (argv.includes("--help")) {
		console.log(HELP_TEXT);
		process.exit(0);
	}

	let email: string | undefined;
	let mode: Mode = "dry-run";
	let confirm: string | undefined;
	let json = false;

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		switch (arg) {
			case "--email": {
				const value = argv[i + 1];
				if (!value || value.startsWith("--")) {
					throw new Error("--email requires a value");
				}
				email = value;
				i += 1;
				break;
			}
			case "--dry-run":
				mode = "dry-run";
				break;
			case "--execute":
				mode = "execute";
				break;
			case "--confirm": {
				const value = argv[i + 1];
				if (!value || value.startsWith("--")) {
					throw new Error("--confirm requires a value");
				}
				confirm = value;
				i += 1;
				break;
			}
			case "--json":
				json = true;
				break;
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	if (!email) {
		throw new Error("--email is required");
	}

	if (mode === "execute") {
		if (!confirm) {
			throw new Error("--confirm is required with --execute");
		}
		if (confirm !== email) {
			throw new Error("--confirm must exactly match --email");
		}
	}

	return { email, mode, confirm, json };
}

function requireEnvVars(): void {
	const missing = REQUIRED_ENV_VARS.filter(
		(name) => !process.env[name] || process.env[name]?.trim() === "",
	);
	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}`,
		);
	}
}

function resolvePolarServer(): "sandbox" | "production" {
	const value = process.env.POLAR_SERVER;
	if (value === "sandbox" || value === "production") {
		return value;
	}
	return process.env.NODE_ENV === "production" ? "production" : "sandbox";
}

async function revokeGithubGrant(accessToken: string): Promise<ActionResult> {
	const clientId = process.env.GITHUB_CLIENT_ID ?? "";
	const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? "";
	const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
		"base64",
	);
	const response = await fetch(
		`https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`,
		{
			method: "DELETE",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Basic ${credentials}`,
				"Content-Type": "application/json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			body: JSON.stringify({ access_token: accessToken }),
		},
	);

	if (response.status === 204 || response.status === 404) {
		return {
			status: "success",
			target: "github-grant",
			detail: `status=${response.status}`,
		};
	}

	const body = await response.text();
	return {
		status: "failed",
		target: "github-grant",
		detail: `status=${response.status} body=${body.slice(0, 300)}`,
	};
}

function printHumanSummary(report: DeleteUserReport): void {
	console.log(`[delete-user] mode=${report.mode} email=${report.email}`);

	if (!report.userFound) {
		console.log("[delete-user] user not found (no action required)");
		return;
	}

	console.log(`[delete-user] userId=${report.userId}`);
	console.log("[delete-user] planned targets:");
	console.log(`  sessions: ${report.planned.sessions}`);
	console.log(`  accounts: ${report.planned.accounts}`);
	console.log(`  github accounts: ${report.planned.githubAccounts}`);
	console.log(
		`  github without access token: ${report.planned.githubAccountsWithoutAccessToken}`,
	);
	console.log(`  device codes: ${report.planned.deviceCodes}`);
	console.log(`  command executions: ${report.planned.commandExecutions}`);
	console.log(`  generations: ${report.planned.generations}`);
	console.log(`  generation scores: ${report.planned.generationScores}`);
	console.log(`  polar customers: ${report.planned.polarCustomers}`);

	if (report.mode === "dry-run") {
		console.log(
			"[delete-user] dry-run only; rerun with --execute --confirm <email> to perform deletion",
		);
		return;
	}

	for (const action of report.actions.githubRevokes) {
		console.log(
			`[delete-user] github revoke ${action.status}: ${action.target}${action.detail ? ` (${action.detail})` : ""}`,
		);
	}
	for (const action of report.actions.polarDeletes) {
		console.log(
			`[delete-user] polar delete ${action.status}: ${action.target}${action.detail ? ` (${action.detail})` : ""}`,
		);
	}
	if (report.actions.dbDelete) {
		const action = report.actions.dbDelete;
		console.log(
			`[delete-user] db delete ${action.status}: ${action.target}${action.detail ? ` (${action.detail})` : ""}`,
		);
	}
}

async function run(): Promise<number> {
	let args: ParsedArgs;
	try {
		args = parseArgs(process.argv.slice(2));
		requireEnvVars();
	} catch (error) {
		console.error(
			`[delete-user] ${error instanceof Error ? error.message : "invalid arguments"}`,
		);
		console.error(HELP_TEXT);
		return 1;
	}

	const db = getDb();
	const polarClient = new Polar({
		accessToken: process.env.POLAR_ACCESS_TOKEN,
		server: resolvePolarServer(),
	});

	const report: DeleteUserReport = {
		mode: args.mode,
		email: args.email,
		userFound: false,
		planned: {
			sessions: 0,
			accounts: 0,
			githubAccounts: 0,
			githubAccountsWithoutAccessToken: 0,
			deviceCodes: 0,
			commandExecutions: 0,
			generations: 0,
			generationScores: 0,
			polarCustomers: 0,
		},
		actions: {
			githubRevokes: [],
			polarDeletes: [],
		},
		summary: {
			externalFailures: 0,
			fatalFailure: false,
		},
	};

	try {
		const targetUser = await db
			.select()
			.from(user)
			.where(eq(user.email, args.email))
			.get();

		if (!targetUser) {
			if (args.json) {
				console.log(JSON.stringify(report, null, 2));
			} else {
				printHumanSummary(report);
			}
			return 0;
		}

		report.userFound = true;
		report.userId = targetUser.id;

		const [sessions, accounts, deviceCodes, commandExecutions, polarCustomers] =
			await Promise.all([
				db
					.select({ id: session.id })
					.from(session)
					.where(eq(session.userId, targetUser.id)),
				db
					.select({
						id: account.id,
						providerId: account.providerId,
						accessToken: account.accessToken,
						accountId: account.accountId,
					})
					.from(account)
					.where(eq(account.userId, targetUser.id)),
				db
					.select({ id: deviceCode.id })
					.from(deviceCode)
					.where(eq(deviceCode.userId, targetUser.id)),
				db
					.select({ id: commandExecution.id })
					.from(commandExecution)
					.where(eq(commandExecution.userId, targetUser.id)),
				polarClient.customers.list({ email: args.email }),
			]);

		const commandExecutionIds = commandExecutions.map((row) => row.id);
		const generationRows =
			commandExecutionIds.length > 0
				? await db
						.select({ id: generation.id })
						.from(generation)
						.where(inArray(generation.commandExecutionId, commandExecutionIds))
				: [];
		const generationIds = generationRows.map((row) => row.id);
		const generationScoreRows =
			generationIds.length > 0
				? await db
						.select({ id: generationScore.id })
						.from(generationScore)
						.where(inArray(generationScore.generationId, generationIds))
				: [];

		const githubAccounts = accounts.filter(
			(row) => row.providerId === "github",
		);
		const githubWithoutToken = githubAccounts.filter((row) => !row.accessToken);

		report.planned = {
			sessions: sessions.length,
			accounts: accounts.length,
			githubAccounts: githubAccounts.length,
			githubAccountsWithoutAccessToken: githubWithoutToken.length,
			deviceCodes: deviceCodes.length,
			commandExecutions: commandExecutions.length,
			generations: generationRows.length,
			generationScores: generationScoreRows.length,
			polarCustomers: polarCustomers.result.items.length,
		};

		for (const gh of githubAccounts) {
			if (!gh.accessToken) {
				report.actions.githubRevokes.push({
					status: "skipped",
					target: `account:${gh.id}`,
					detail: "access_token is empty",
				});
				continue;
			}

			if (args.mode === "dry-run") {
				report.actions.githubRevokes.push({
					status: "skipped",
					target: `account:${gh.id}`,
					detail: "dry-run",
				});
				continue;
			}

			try {
				const result = await revokeGithubGrant(gh.accessToken);
				report.actions.githubRevokes.push({
					...result,
					target: `account:${gh.id}`,
				});
				if (result.status === "failed") {
					report.summary.externalFailures += 1;
				}
			} catch (error) {
				report.summary.externalFailures += 1;
				report.actions.githubRevokes.push({
					status: "failed",
					target: `account:${gh.id}`,
					detail: error instanceof Error ? error.message : "unknown error",
				});
			}
		}

		for (const customer of polarCustomers.result.items) {
			if (args.mode === "dry-run") {
				report.actions.polarDeletes.push({
					status: "skipped",
					target: `customer:${customer.id}`,
					detail: "dry-run",
				});
				continue;
			}

			try {
				await polarClient.customers.delete({ id: customer.id });
				report.actions.polarDeletes.push({
					status: "success",
					target: `customer:${customer.id}`,
				});
			} catch (error) {
				report.summary.externalFailures += 1;
				report.actions.polarDeletes.push({
					status: "failed",
					target: `customer:${customer.id}`,
					detail: error instanceof Error ? error.message : "unknown error",
				});
			}
		}

		if (args.mode === "execute") {
			try {
				const deleted = await db
					.delete(user)
					.where(and(eq(user.id, targetUser.id), eq(user.email, args.email)))
					.returning({ id: user.id });
				report.actions.dbDelete = deleted.length
					? {
							status: "success",
							target: `user:${targetUser.id}`,
						}
					: {
							status: "failed",
							target: `user:${targetUser.id}`,
							detail: "user row not deleted",
						};
				if (deleted.length === 0) {
					report.summary.fatalFailure = true;
				}
			} catch (error) {
				report.summary.fatalFailure = true;
				report.actions.dbDelete = {
					status: "failed",
					target: `user:${targetUser.id}`,
					detail: error instanceof Error ? error.message : "unknown error",
				};
			}
		}
	} catch (error) {
		report.summary.fatalFailure = true;
		if (args.json) {
			console.log(
				JSON.stringify(
					{
						...report,
						error: error instanceof Error ? error.message : "unknown error",
					},
					null,
					2,
				),
			);
		} else {
			console.error(
				`[delete-user] fatal error: ${error instanceof Error ? error.message : "unknown error"}`,
			);
		}
		return 1;
	}

	if (args.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		printHumanSummary(report);
	}

	if (report.summary.fatalFailure) {
		return 1;
	}
	if (args.mode === "execute" && report.summary.externalFailures > 0) {
		return 2;
	}
	return 0;
}

run()
	.then((code) => {
		process.exitCode = code;
	})
	.catch((error) => {
		console.error(
			`[delete-user] unexpected error: ${error instanceof Error ? error.message : "unknown error"}`,
		);
		process.exitCode = 1;
	});
