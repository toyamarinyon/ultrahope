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

export type Mode = "dry-run" | "execute";
type ResultStatus = "success" | "failed" | "skipped";

type ActionResult = {
	status: ResultStatus;
	target: string;
	detail?: string;
};

export type DeleteUserReport = {
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

const REQUIRED_ACCOUNT_DELETION_ENV_VARS = [
	"TURSO_DATABASE_URL",
	"TURSO_AUTH_TOKEN",
	"POLAR_ACCESS_TOKEN",
	"GITHUB_CLIENT_ID",
	"GITHUB_CLIENT_SECRET",
] as const;

function revokeGithubGrantParams() {
	const clientId = process.env.GITHUB_CLIENT_ID ?? "";
	const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? "";
	const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
		"base64",
	);
	return { clientId, credentials };
}

async function revokeGithubGrant(accessToken: string): Promise<ActionResult> {
	const { clientId, credentials } = revokeGithubGrantParams();
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

export function requireAccountDeletionEnvVars(): void {
	const missing = REQUIRED_ACCOUNT_DELETION_ENV_VARS.filter(
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

export async function deleteUserByEmail({
	email,
	mode,
}: {
	email: string;
	mode: Mode;
}): Promise<DeleteUserReport> {
	const db = getDb();
	const polarClient = new Polar({
		accessToken: process.env.POLAR_ACCESS_TOKEN,
		server: resolvePolarServer(),
	});

	const report: DeleteUserReport = {
		mode,
		email,
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

	const targetUser = await db
		.select()
		.from(user)
		.where(eq(user.email, email))
		.get();

	if (!targetUser) {
		return report;
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
			polarClient.customers.list({ email }),
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

	const githubAccounts = accounts.filter((row) => row.providerId === "github");
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

		if (mode === "dry-run") {
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
		if (mode === "dry-run") {
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

	if (mode === "execute") {
		try {
			const deleted = await db
				.delete(user)
				.where(and(eq(user.id, targetUser.id), eq(user.email, email)))
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

	return report;
}
