import { execSync } from "node:child_process";
import { createApiClient, InsufficientBalanceError } from "../lib/api-client";
import { getToken } from "../lib/auth";
import { selectCandidate } from "../lib/selector";

interface DescribeOptions {
	revision: string;
	dryRun: boolean;
	interactive: boolean;
	n: number;
}

function parseDescribeArgs(args: string[]): DescribeOptions {
	let revision = "@";
	let dryRun = false;
	let interactive = true;
	let n = 4;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-r") {
			revision = args[++i] || "@";
		} else if (arg === "--dry-run") {
			dryRun = true;
		} else if (arg === "--no-interactive") {
			interactive = false;
		} else if (arg === "-n") {
			const value = Number.parseInt(args[++i], 10);
			if (!Number.isNaN(value) && value >= 1 && value <= 8) {
				n = value;
			}
		}
	}

	return { revision, dryRun, interactive, n };
}

function getJjDiff(revision: string): string {
	try {
		return execSync(`jj diff -r ${revision}`, { encoding: "utf-8" });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (
			message.includes("command not found") ||
			message.includes("not recognized")
		) {
			console.error("Error: jj is not installed or not in PATH.");
		} else if (message.includes("not a valid repository")) {
			console.error("Error: Not a jj repository.");
		} else {
			console.error(`Error: Failed to get diff for revision ${revision}.`);
		}
		process.exit(1);
	}
}

async function generateDescriptions(
	diff: string,
	n: number,
): Promise<string[]> {
	const token = await getToken();
	if (!token) {
		console.error("Error: Not authenticated. Run `ultrahope login` first.");
		process.exit(1);
	}

	const api = createApiClient(token);
	try {
		const result = await api.translate({
			input: diff,
			target: "vcs-commit-message",
			n,
		});
		if ("outputs" in result) {
			return result.outputs;
		}
		return [result.output];
	} catch (error) {
		if (error instanceof InsufficientBalanceError) {
			console.error(
				"Error: Token balance exhausted. Upgrade your plan at https://ultrahope.dev/pricing",
			);
			process.exit(1);
		}
		throw error;
	}
}

function describeRevision(revision: string, message: string): void {
	try {
		execSync(`jj describe -r ${revision} -m ${JSON.stringify(message)}`, {
			stdio: "inherit",
		});
	} catch {
		process.exit(1);
	}
}

async function describe(args: string[]) {
	const options = parseDescribeArgs(args);
	const diff = getJjDiff(options.revision);

	if (!diff.trim()) {
		console.error(`Error: No changes in revision ${options.revision}.`);
		process.exit(1);
	}

	if (!options.interactive) {
		const [message] = await generateDescriptions(diff, 1);

		if (options.dryRun) {
			console.log(message);
			return;
		}

		describeRevision(options.revision, message);
		return;
	}

	let candidates = await generateDescriptions(diff, options.n);

	if (options.dryRun) {
		for (const candidate of candidates) {
			console.log("---");
			console.log(candidate);
		}
		return;
	}

	while (true) {
		const result = await selectCandidate({
			candidates,
			prompt: "Select a commit message:",
		});

		if (result.action === "abort") {
			console.error("Aborted.");
			process.exit(1);
		}

		if (result.action === "reroll") {
			candidates = await generateDescriptions(diff, options.n);
			continue;
		}

		if (result.action === "confirm" && result.selected) {
			describeRevision(options.revision, result.selected);
			return;
		}
	}
}

function printHelp() {
	console.log(`Usage: ultrahope jj <command>

Commands:
  describe    Generate commit description from changes

Describe options:
  -r <revset>       Revision to describe (default: @)
  --dry-run         Print candidates only, don't describe
  --no-interactive  Single candidate, no selection
  -n <count>        Number of candidates (default: 4)

Examples:
  ultrahope jj describe              # interactive mode
  ultrahope jj describe -r @-        # for parent revision
  ultrahope jj describe --dry-run    # print candidates only`);
}

export async function jj(args: string[]) {
	const [command, ...rest] = args;

	switch (command) {
		case "describe":
			await describe(rest);
			break;
		case "--help":
		case "-h":
		case undefined:
			printHelp();
			break;
		default:
			console.error(`Unknown command: ${command}`);
			console.error("Run `ultrahope jj --help` for usage.");
			process.exit(1);
	}
}
