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
	selectedIndex?: number;
}

export interface CandidateWithModel {
	content: string;
	model?: string;
	cost?: number;
}

type Slot =
	| { status: "pending" }
	| { status: "ready"; candidate: CandidateWithModel };

interface SelectorOptions {
	candidates: AsyncIterable<CandidateWithModel> | CandidateWithModel[];
	maxSlots?: number;
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

function formatModelName(model: string): string {
	const parts = model.split("/");
	return parts.length > 1 ? parts[1] : model;
}

function formatCost(cost: number): string {
	return `$${cost}`;
}

function formatSlot(
	slot: Slot,
	index: number,
	selected: boolean,
	width: number,
): string[] {
	const prefix = selected ? " > " : "   ";
	const marker = `[${index + 1}]`;

	if (slot.status === "pending") {
		const pendingLine = `${prefix}${marker} ⏳ Generating...`;
		return [
			selected
				? `\x1b[2;36m${pendingLine}\x1b[0m`
				: `\x1b[2m${pendingLine}\x1b[0m`,
		];
	}

	const candidate = slot.candidate;
	const lines = candidate.content.split("\n").filter((l) => l.trim());

	const formatted: string[] = [];
	const indent = " ".repeat(marker.length + 1);
	const headerLine = `${prefix}${marker} ${truncate(lines[0] || "", width - prefix.length - marker.length - 1)}`;
	formatted.push(selected ? `\x1b[36m${headerLine}\x1b[0m` : headerLine);

	if (lines.length > 1 || candidate.model) {
		formatted.push("");
	}

	for (let i = 1; i < Math.min(lines.length, 3); i++) {
		const bodyLine = `${prefix}${indent}${truncate(lines[i], width - prefix.length - indent.length)}`;
		formatted.push(
			selected ? `\x1b[2m${bodyLine}\x1b[0m` : `\x1b[2m${bodyLine}\x1b[0m`,
		);
	}

	if (candidate.model) {
		const modelInfo = candidate.cost
			? `[${formatModelName(candidate.model)} · ${formatCost(candidate.cost)}]`
			: `[${formatModelName(candidate.model)}]`;
		const modelLine = `${prefix}${indent}\x1b[2m${modelInfo}\x1b[0m`;
		formatted.push(modelLine);
	}

	return formatted;
}

let lastRenderLineCount = 0;

function render(slots: Slot[], selectedIndex: number, prompt: string): void {
	const width = process.stdout.columns || 80;

	if (lastRenderLineCount > 0) {
		process.stdout.write(`\x1b[${lastRenderLineCount}A`);
		process.stdout.write("\x1b[0J");
	}

	const lines: string[] = [];
	lines.push(`\x1b[1m${prompt}\x1b[0m`);
	lines.push("");

	const cols = Math.min(2, slots.length);
	const colWidth = Math.floor((width - 4) / cols);

	for (let row = 0; row < Math.ceil(slots.length / cols); row++) {
		const leftIdx = row * cols;
		const rightIdx = leftIdx + 1;

		const leftLines =
			leftIdx < slots.length
				? formatSlot(
						slots[leftIdx],
						leftIdx,
						leftIdx === selectedIndex,
						colWidth,
					)
				: [];
		const rightLines =
			rightIdx < slots.length && cols > 1
				? formatSlot(
						slots[rightIdx],
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

	const hasReady = slots.some((s) => s.status === "ready");
	const hint = hasReady
		? "\x1b[2m  [1-4] Select  [e] Edit  [Enter] Confirm  [r] Reroll  [q] Abort\x1b[0m"
		: "\x1b[2m  Waiting for candidates...  [q] Abort\x1b[0m";
	lines.push(hint);

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
	const { candidates, maxSlots = 4, prompt = "Select a result:" } = options;

	if (Array.isArray(candidates)) {
		if (!canUseInteractive() || candidates.length === 0) {
			return {
				action: "confirm",
				selected: candidates[0]?.content,
				selectedIndex: 0,
			};
		}
		const slots: Slot[] = candidates.map((c) => ({
			status: "ready",
			candidate: c,
		}));
		return selectFromSlots(slots, prompt, null);
	}

	if (!canUseInteractive()) {
		const first = await (async () => {
			for await (const c of candidates) return c;
			return undefined;
		})();
		return {
			action: "confirm",
			selected: first?.content,
			selectedIndex: 0,
		};
	}

	const slots: Slot[] = Array.from({ length: maxSlots }, () => ({
		status: "pending",
	}));
	const abortController = new AbortController();
	return selectFromSlots(slots, prompt, { candidates, abortController });
}

interface AsyncContext {
	candidates: AsyncIterable<CandidateWithModel>;
	abortController: AbortController;
}

async function selectFromSlots(
	initialSlots: Slot[],
	prompt: string,
	asyncCtx: AsyncContext | null,
): Promise<SelectorResult> {
	return new Promise((resolve) => {
		let selectedIndex = 0;
		const slots = [...initialSlots];

		const fd = openSync("/dev/tty", "r");
		const ttyInput = new tty.ReadStream(fd);

		const rl = readline.createInterface({
			input: ttyInput,
			output: process.stdout,
			terminal: true,
		});

		readline.emitKeypressEvents(ttyInput, rl);
		ttyInput.setRawMode(true);

		render(slots, selectedIndex, prompt);

		const cleanup = () => {
			asyncCtx?.abortController.abort();
			ttyInput.setRawMode(false);
			rl.close();
			ttyInput.destroy();
			if (lastRenderLineCount > 0) {
				process.stdout.write(`\x1b[${lastRenderLineCount}A`);
				process.stdout.write("\x1b[0J");
			}
			lastRenderLineCount = 0;
		};

		if (asyncCtx) {
			(async () => {
				let i = 0;
				try {
					for await (const candidate of asyncCtx.candidates) {
						if (asyncCtx.abortController.signal.aborted) break;
						if (i < slots.length) {
							slots[i] = { status: "ready", candidate };
							if (
								selectedIndex >= slots.length ||
								slots[selectedIndex].status === "pending"
							) {
								selectedIndex = i;
							}
							render(slots, selectedIndex, prompt);
							i++;
						}
					}
					const readySlots = slots.filter((s) => s.status === "ready");
					if (readySlots.length < slots.length) {
						slots.length = readySlots.length;
						for (let j = 0; j < readySlots.length; j++) {
							slots[j] = readySlots[j];
						}
						if (selectedIndex >= slots.length) {
							selectedIndex = Math.max(0, slots.length - 1);
						}
						render(slots, selectedIndex, prompt);
					}
				} catch (err) {
					if (!asyncCtx.abortController.signal.aborted) {
						console.error("Error fetching candidates:", err);
					}
				}
			})();
		}

		const getSelectedCandidate = (): CandidateWithModel | undefined => {
			const slot = slots[selectedIndex];
			return slot?.status === "ready" ? slot.candidate : undefined;
		};

		const hasReadySlot = (): boolean => slots.some((s) => s.status === "ready");

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
				const candidate = getSelectedCandidate();
				if (!candidate) return;
				cleanup();
				resolve({
					action: "confirm",
					selected: candidate.content,
					selectedIndex,
				});
				return;
			}

			if (key.name === "r") {
				if (!hasReadySlot()) return;
				cleanup();
				resolve({ action: "reroll" });
				return;
			}

			if (key.name === "e") {
				const candidate = getSelectedCandidate();
				if (!candidate) return;
				ttyInput.setRawMode(false);
				try {
					const edited = await openEditor(candidate.content);
					if (edited) {
						slots[selectedIndex] = {
							status: "ready",
							candidate: { ...candidate, content: edited },
						};
					}
				} catch {}
				ttyInput.setRawMode(true);
				render(slots, selectedIndex, prompt);
				return;
			}

			if (key.name === "up" || key.name === "k") {
				const newIndex = Math.max(0, selectedIndex - 2);
				if (slots[newIndex]?.status === "ready") {
					selectedIndex = newIndex;
					render(slots, selectedIndex, prompt);
				}
				return;
			}

			if (key.name === "down" || key.name === "j") {
				const newIndex = Math.min(slots.length - 1, selectedIndex + 2);
				if (slots[newIndex]?.status === "ready") {
					selectedIndex = newIndex;
					render(slots, selectedIndex, prompt);
				}
				return;
			}

			if (key.name === "left" || key.name === "h") {
				if (
					selectedIndex % 2 === 1 &&
					slots[selectedIndex - 1]?.status === "ready"
				) {
					selectedIndex--;
					render(slots, selectedIndex, prompt);
				}
				return;
			}

			if (key.name === "right" || key.name === "l") {
				if (
					selectedIndex % 2 === 0 &&
					selectedIndex + 1 < slots.length &&
					slots[selectedIndex + 1]?.status === "ready"
				) {
					selectedIndex++;
					render(slots, selectedIndex, prompt);
				}
				return;
			}

			const num = Number.parseInt(key.name || "", 10);
			if (
				num >= 1 &&
				num <= slots.length &&
				slots[num - 1]?.status === "ready"
			) {
				selectedIndex = num - 1;
				render(slots, selectedIndex, prompt);
				return;
			}
		};

		ttyInput.on("keypress", handleKeypress);
	});
}
