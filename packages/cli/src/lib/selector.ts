import { spawn } from "node:child_process";
import {
	accessSync,
	constants,
	mkdtempSync,
	openSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as readline from "node:readline";
import * as tty from "node:tty";

export interface SelectorResult {
	action: "confirm" | "abort" | "reroll";
	selected?: string;
}

interface SelectorOptions {
	candidates: string[];
	prompt?: string;
}

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

function truncate(str: string, maxLen: number): string {
	const firstLine = str.split("\n")[0];
	if (firstLine.length <= maxLen) return firstLine;
	return `${firstLine.slice(0, maxLen - 1)}…`;
}

function formatCandidate(
	candidate: string,
	index: number,
	selected: boolean,
	width: number,
): string[] {
	const lines = candidate.split("\n").filter((l) => l.trim());
	const prefix = selected ? " > " : "   ";
	const marker = `[${index + 1}]`;

	const formatted: string[] = [];
	const headerLine = `${prefix}${marker} ${truncate(lines[0] || "", width - prefix.length - marker.length - 1)}`;
	formatted.push(selected ? `\x1b[36m${headerLine}\x1b[0m` : headerLine);

	for (let i = 1; i < Math.min(lines.length, 3); i++) {
		const bodyLine = `${prefix}      ${truncate(lines[i], width - prefix.length - 6)}`;
		formatted.push(
			selected ? `\x1b[2m${bodyLine}\x1b[0m` : `\x1b[2m${bodyLine}\x1b[0m`,
		);
	}

	return formatted;
}

let lastRenderLineCount = 0;

function render(
	candidates: string[],
	selectedIndex: number,
	prompt: string,
): void {
	const width = process.stdout.columns || 80;

	if (lastRenderLineCount > 0) {
		process.stdout.write(`\x1b[${lastRenderLineCount}A`);
		process.stdout.write("\x1b[0J");
	}

	const lines: string[] = [];
	lines.push(`\x1b[1m${prompt}\x1b[0m`);
	lines.push("");

	const cols = Math.min(2, candidates.length);
	const colWidth = Math.floor((width - 4) / cols);

	for (let row = 0; row < Math.ceil(candidates.length / cols); row++) {
		const leftIdx = row * cols;
		const rightIdx = leftIdx + 1;

		const leftLines =
			leftIdx < candidates.length
				? formatCandidate(
						candidates[leftIdx],
						leftIdx,
						leftIdx === selectedIndex,
						colWidth,
					)
				: [];
		const rightLines =
			rightIdx < candidates.length && cols > 1
				? formatCandidate(
						candidates[rightIdx],
						rightIdx,
						rightIdx === selectedIndex,
						colWidth,
					)
				: [];

		const maxRowLines = Math.max(leftLines.length, rightLines.length);
		for (let i = 0; i < maxRowLines; i++) {
			const left = leftLines[i] || "";
			const right = rightLines[i] || "";
			// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ANSI escape code stripping
			const leftVisible = left.replace(/\x1b\[[0-9;]*m/g, "");
			const padding = " ".repeat(Math.max(0, colWidth - leftVisible.length));
			lines.push(`${left}${padding}${right}`);
		}
		lines.push("");
	}

	lines.push(
		"\x1b[2m  [1-4] Select  [e] Edit  [Enter] Confirm  [r] Reroll  [q] Abort\x1b[0m",
	);

	for (const line of lines) {
		console.log(line);
	}
	lastRenderLineCount = lines.length;
}

function openEditor(content: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const editor = process.env.GIT_EDITOR || process.env.EDITOR || "vi";
		const tmpDir = mkdtempSync(join(tmpdir(), "ultrahope-"));
		const tmpFile = join(tmpDir, "EDIT_MESSAGE");

		writeFileSync(tmpFile, content);

		const child = spawn(editor, [tmpFile], { stdio: "inherit" });

		child.on("close", (code) => {
			if (code !== 0) {
				unlinkSync(tmpFile);
				reject(new Error(`Editor exited with code ${code}`));
				return;
			}
			const result = readFileSync(tmpFile, "utf-8").trim();
			unlinkSync(tmpFile);
			resolve(result);
		});

		child.on("error", (err) => {
			try {
				unlinkSync(tmpFile);
			} catch {}
			reject(err);
		});
	});
}

export async function selectCandidate(
	options: SelectorOptions,
): Promise<SelectorResult> {
	const { candidates, prompt = "Select a result:" } = options;

	if (!canUseInteractive() || candidates.length === 0) {
		return { action: "confirm", selected: candidates[0] };
	}

	return new Promise((resolve) => {
		let selectedIndex = 0;
		const currentCandidates = [...candidates];

		const fd = openSync("/dev/tty", "r");
		const ttyInput = new tty.ReadStream(fd);

		const rl = readline.createInterface({
			input: ttyInput,
			output: process.stdout,
			terminal: true,
		});

		readline.emitKeypressEvents(ttyInput, rl);
		ttyInput.setRawMode(true);

		render(currentCandidates, selectedIndex, prompt);

		const cleanup = () => {
			ttyInput.setRawMode(false);
			rl.close();
			ttyInput.destroy();
			if (lastRenderLineCount > 0) {
				process.stdout.write(`\x1b[${lastRenderLineCount}A`);
				process.stdout.write("\x1b[0J");
			}
			lastRenderLineCount = 0;
		};

		const handleKeypress = async (
			_str: string | undefined,
			key: readline.Key,
		) => {
			if (!key) return;

			if (
				key.name === "q" ||
				(key.name === "c" && key.ctrl) ||
				key.name === "escape"
			) {
				cleanup();
				resolve({ action: "abort" });
				return;
			}

			if (key.name === "return") {
				cleanup();
				resolve({
					action: "confirm",
					selected: currentCandidates[selectedIndex],
				});
				return;
			}

			if (key.name === "r") {
				cleanup();
				resolve({ action: "reroll" });
				return;
			}

			if (key.name === "e") {
				ttyInput.setRawMode(false);
				try {
					const edited = await openEditor(currentCandidates[selectedIndex]);
					if (edited) {
						currentCandidates[selectedIndex] = edited;
					}
				} catch {}
				ttyInput.setRawMode(true);
				render(currentCandidates, selectedIndex, prompt);
				return;
			}

			if (key.name === "up" || key.name === "k") {
				selectedIndex = Math.max(0, selectedIndex - 2);
				render(currentCandidates, selectedIndex, prompt);
				return;
			}

			if (key.name === "down" || key.name === "j") {
				selectedIndex = Math.min(
					currentCandidates.length - 1,
					selectedIndex + 2,
				);
				render(currentCandidates, selectedIndex, prompt);
				return;
			}

			if (key.name === "left" || key.name === "h") {
				if (selectedIndex % 2 === 1) {
					selectedIndex--;
					render(currentCandidates, selectedIndex, prompt);
				}
				return;
			}

			if (key.name === "right" || key.name === "l") {
				if (
					selectedIndex % 2 === 0 &&
					selectedIndex + 1 < currentCandidates.length
				) {
					selectedIndex++;
					render(currentCandidates, selectedIndex, prompt);
				}
				return;
			}

			const num = Number.parseInt(key.name || "", 10);
			if (num >= 1 && num <= currentCandidates.length) {
				selectedIndex = num - 1;
				render(currentCandidates, selectedIndex, prompt);
				return;
			}
		};

		ttyInput.on("keypress", handleKeypress);
	});
}
