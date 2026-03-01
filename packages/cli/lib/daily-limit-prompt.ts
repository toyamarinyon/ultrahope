import * as readline from "node:readline";
import type * as tty from "node:tty";
import open from "open";
import { formatResetTime } from "./format-time";
import { theme } from "./theme";
import { createTtyStreams, type StreamCleanup } from "./tty";
import { ui } from "./ui";

const PRICING_URL = "https://ultrahope.dev/pricing";

function canUseInteractive(): boolean {
	try {
		const { cleanup } = createTtyStreams();
		cleanup();
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
			ui.blocked(
				`Generating commit messages... ${info.progress.ready}/${info.progress.total}`,
			),
		);
	}
	console.log("");
	console.log(
		`${theme.primary}Commit message generation was skipped${theme.reset}`,
	);
	console.log("");
	console.log(
		ui.bullet(`Daily request limit reached (${info.count} / ${info.limit})`),
	);
	console.log(ui.bullet(`Resets ${relative} (${local})`));
	console.log("");

	if (!canUseInteractive()) {
		console.log(
			`${theme.primary}Run the same command again after the reset:${theme.reset}`,
		);
		console.log(`  ${ui.link("ultrahope jj describe")}`);
		console.log("");
		console.log(`${theme.primary}Or upgrade your plan:${theme.reset}`);
		console.log(`  ${ui.link(PRICING_URL)}`);
		return;
	}

	console.log(`${theme.primary}What would you like to do?${theme.reset}`);
	console.log("");
	console.log(
		`${theme.secondary}  1) Retry after the daily limit resets${theme.reset}`,
	);
	console.log(
		`${theme.secondary}  2) Upgrade your plan to continue immediately${theme.reset}`,
	);
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
		let ttyInput: tty.ReadStream;
		let ttyOutput: tty.WriteStream;
		let cleanupTTY: StreamCleanup;
		try {
			const ttyStreams = createTtyStreams();
			ttyInput = ttyStreams.input;
			ttyOutput = ttyStreams.output;
			cleanupTTY = ttyStreams.cleanup;
		} catch {
			console.error(
				"Error: /dev/tty is not available. Interactive mode requires a terminal.",
			);
			process.exit(1);
		}

		const rl = readline.createInterface({
			input: ttyInput,
			output: ttyOutput,
			terminal: true,
		});

		ttyOutput.write(
			`${theme.prompt}Select an option [1-2], or press q to quit:${theme.reset} `,
		);

		readline.emitKeypressEvents(ttyInput, rl);
		ttyInput.setRawMode(true);

		const cleanup = () => {
			ttyInput.setRawMode(false);
			rl.close();
			ttyOutput.write("\n");
			cleanupTTY();
		};

		const handleKeypress = (str: string | undefined, key: readline.Key) => {
			if (!key && !str) return;

			if (
				str === "q" ||
				str === "Q" ||
				key?.name === "q" ||
				(key?.name === "c" && key.ctrl) ||
				key?.name === "escape"
			) {
				cleanup();
				resolve("q");
				return;
			}

			if (str === "1" || key?.name === "1" || key?.sequence === "1") {
				cleanup();
				resolve("1");
				return;
			}

			if (str === "2" || key?.name === "2" || key?.sequence === "2") {
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
	console.log(ui.success("Will retry after the daily limit resets"));
	console.log(ui.bullet("No requests were sent"));
	console.log("");
	console.log(
		`${theme.primary}Run the same command again after the reset:${theme.reset}`,
	);
	console.log(`  ${ui.link("ultrahope jj describe")}`);
	console.log("");

	return new Promise<void>((resolve) => {
		let ttyInput: tty.ReadStream;
		let ttyOutput: tty.WriteStream;
		let cleanupTTY: StreamCleanup;
		try {
			const ttyStreams = createTtyStreams();
			ttyInput = ttyStreams.input;
			ttyOutput = ttyStreams.output;
			cleanupTTY = ttyStreams.cleanup;
		} catch {
			console.error(
				"Error: /dev/tty is not available. Interactive mode requires a terminal.",
			);
			process.exit(1);
		}

		const rl = readline.createInterface({
			input: ttyInput,
			output: ttyOutput,
			terminal: true,
		});

		readline.emitKeypressEvents(ttyInput, rl);
		ttyInput.setRawMode(true);

		const cleanup = () => {
			ttyInput.setRawMode(false);
			rl.close();
			ttyOutput.write("\n");
			cleanupTTY();
		};

		const handleKeypress = (str: string | undefined, key: readline.Key) => {
			if (!key && !str) return;
			if (
				str === "\r" ||
				str === "\n" ||
				str === "q" ||
				str === "Q" ||
				key?.name === "return" ||
				key?.name === "q" ||
				(key?.name === "c" && key.ctrl)
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
	console.log(`${theme.primary}Opening pricing page:${theme.reset}`);
	console.log(`  ${ui.link(PRICING_URL)}`);

	try {
		await open(PRICING_URL);
	} catch {
		// Browser open failed silently - URL is already printed
	}
}
