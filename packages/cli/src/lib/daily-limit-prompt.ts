import { accessSync, constants, openSync } from "node:fs";
import * as readline from "node:readline";
import * as tty from "node:tty";
import open from "open";
import { formatResetTime } from "./format-time";

const PRICING_URL = "https://ultrahope.dev/pricing";

function canUseInteractive(): boolean {
	if (!process.stdout.isTTY) {
		return false;
	}
	try {
		accessSync("/dev/tty", constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

interface DailyLimitInfo {
	count: number;
	limit: number;
	resetsAt: string;
	progress?: { ready: number; total: number };
}

export async function showDailyLimitPrompt(
	info: DailyLimitInfo,
): Promise<void> {
	const { relative, local } = formatResetTime(info.resetsAt);

	if (info.progress) {
		console.log(
			`\x1b[31m✖\x1b[0m Generating commit messages... ${info.progress.ready}/${info.progress.total}`,
		);
	}
	console.log(`Commit message generation was skipped`);
	console.log(
		`  \x1b[2m•\x1b[0m Daily request limit reached (${info.count} / ${info.limit})`,
	);
	console.log(`  \x1b[2m•\x1b[0m Resets ${relative} (${local})`);
	console.log("");

	if (!canUseInteractive()) {
		console.log("Run the same command again after the reset:");
		console.log("  ultrahope jj describe");
		console.log("");
		console.log("Or upgrade your plan:");
		console.log(`  ${PRICING_URL}`);
		return;
	}

	console.log("What would you like to do?");
	console.log("");
	console.log("  1) Retry after the daily limit resets");
	console.log("  2) Upgrade your plan to continue immediately");
	console.log("");

	const choice = await promptChoice();

	switch (choice) {
		case "1":
			handleRetryLater();
			break;
		case "2":
			await handleUpgrade();
			break;
		case "q":
			break;
	}
}

function promptChoice(): Promise<"1" | "2" | "q"> {
	return new Promise((resolve) => {
		const fd = openSync("/dev/tty", "r");
		const ttyInput = new tty.ReadStream(fd);

		const rl = readline.createInterface({
			input: ttyInput,
			output: process.stdout,
			terminal: true,
		});

		process.stdout.write("Select an option [1-2], or press q to quit: ");

		readline.emitKeypressEvents(ttyInput, rl);
		ttyInput.setRawMode(true);

		const cleanup = () => {
			ttyInput.setRawMode(false);
			rl.close();
			ttyInput.destroy();
			console.log("");
		};

		const handleKeypress = (_str: string | undefined, key: readline.Key) => {
			if (!key) return;

			if (
				key.name === "q" ||
				(key.name === "c" && key.ctrl) ||
				key.name === "escape"
			) {
				cleanup();
				resolve("q");
				return;
			}

			if (key.name === "1") {
				cleanup();
				resolve("1");
				return;
			}

			if (key.name === "2") {
				cleanup();
				resolve("2");
				return;
			}
		};

		ttyInput.on("keypress", handleKeypress);
	});
}

function handleRetryLater() {
	console.log("");
	console.log("\x1b[32m✔\x1b[0m Will retry after the daily limit resets");
	console.log("  \x1b[2m•\x1b[0m No requests were sent");
	console.log("");
	console.log("Run the same command again after the reset:");
	console.log("  ultrahope jj describe");
	console.log("");
	process.stdout.write("Press Enter to exit ");

	return new Promise<void>((resolve) => {
		const fd = openSync("/dev/tty", "r");
		const ttyInput = new tty.ReadStream(fd);

		const rl = readline.createInterface({
			input: ttyInput,
			output: process.stdout,
			terminal: true,
		});

		readline.emitKeypressEvents(ttyInput, rl);
		ttyInput.setRawMode(true);

		const cleanup = () => {
			ttyInput.setRawMode(false);
			rl.close();
			ttyInput.destroy();
			console.log("");
		};

		const handleKeypress = (_str: string | undefined, key: readline.Key) => {
			if (!key) return;
			if (
				key.name === "return" ||
				key.name === "q" ||
				(key.name === "c" && key.ctrl)
			) {
				cleanup();
				resolve();
			}
		};

		ttyInput.on("keypress", handleKeypress);
	});
}

async function handleUpgrade(): Promise<void> {
	console.log("");
	console.log("Opening pricing page:");
	console.log(`  ${PRICING_URL}`);

	try {
		await open(PRICING_URL);
	} catch {
		// Browser open failed silently - URL is already printed
	}
}
