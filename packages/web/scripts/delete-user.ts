import {
	type DeleteUserReport,
	deleteUserByEmail,
	type Mode,
	requireAccountDeletionEnvVars,
} from "../lib/util/account-deletion";

type ParsedArgs = {
	email: string;
	mode: Mode;
	confirm?: string;
	json: boolean;
};

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
		requireAccountDeletionEnvVars();
	} catch (error) {
		console.error(
			`[delete-user] ${error instanceof Error ? error.message : "invalid arguments"}`,
		);
		console.error(HELP_TEXT);
		return 1;
	}

	try {
		const report = await deleteUserByEmail({
			email: args.email,
			mode: args.mode,
		});

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
	} catch (error) {
		console.error(
			`[delete-user] fatal error: ${error instanceof Error ? error.message : "unknown error"}`,
		);
		return 1;
	}
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
