import { createApiClient, InsufficientBalanceError } from "../lib/api-client";
import { getToken } from "../lib/auth";
import { selectCandidate } from "../lib/selector";
import { stdin } from "../lib/stdin";

type Target = "vcs-commit-message" | "pr-title-body" | "pr-intent";

const VALID_TARGETS: Target[] = [
	"vcs-commit-message",
	"pr-title-body",
	"pr-intent",
];

interface TranslateOptions {
	target: Target;
	interactive: boolean;
	n: number;
}

export async function translate(args: string[]) {
	const options = parseArgs(args);
	const input = await stdin();

	if (!input.trim()) {
		console.error(
			"Error: No input provided. Pipe content to ultrahope translate.",
		);
		process.exit(1);
	}

	const token = await getToken();
	if (!token) {
		console.error("Error: Not authenticated. Run `ultrahope login` first.");
		process.exit(1);
	}

	const api = createApiClient(token);

	const doTranslate = async (n: number): Promise<string[]> => {
		try {
			const result = await api.translate({ input, target: options.target, n });
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
	};

	if (!options.interactive) {
		const [output] = await doTranslate(1);
		console.log(output);
		return;
	}

	let candidates = await doTranslate(options.n);

	while (true) {
		const result = await selectCandidate({
			candidates,
			prompt: "Select a result:",
		});

		if (result.action === "abort") {
			console.error("Aborted.");
			process.exit(1);
		}

		if (result.action === "reroll") {
			candidates = await doTranslate(options.n);
			continue;
		}

		if (result.action === "confirm" && result.selected) {
			console.log(result.selected);
			return;
		}
	}
}

function parseArgs(args: string[]): TranslateOptions {
	let target: Target | undefined;
	let interactive = true;
	let n = 4;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--target" || arg === "-t") {
			const value = args[++i];
			if (!value || !VALID_TARGETS.includes(value as Target)) {
				console.error(`Error: Invalid target "${value}"`);
				console.error(`Valid targets: ${VALID_TARGETS.join(", ")}`);
				process.exit(1);
			}
			target = value as Target;
		} else if (arg === "--no-interactive") {
			interactive = false;
		} else if (arg === "-n") {
			const value = Number.parseInt(args[++i], 10);
			if (Number.isNaN(value) || value < 1 || value > 8) {
				console.error("Error: -n must be between 1 and 8");
				process.exit(1);
			}
			n = value;
		}
	}

	if (!target) {
		console.error("Error: Missing --target option");
		console.error(
			"Usage: ultrahope translate --target <vcs-commit-message|pr-title-body|pr-intent>",
		);
		process.exit(1);
	}

	return { target, interactive, n };
}
