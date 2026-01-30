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
import { theme } from "./theme";
import { ui } from "./ui";

export interface SelectorResult {
	action: "confirm" | "abort" | "reroll";
	selected?: string;
	selectedIndex?: number;
	selectedCandidate?: CandidateWithModel;
}

export interface CandidateWithModel {
	content: string;
	model?: string;
	cost?: number;
	generationId?: string;
}

type Slot =
	| { status: "pending" }
	| { status: "ready"; candidate: CandidateWithModel };

interface SelectorOptions {
	createCandidates: (signal: AbortSignal) => AsyncIterable<CandidateWithModel>;
	maxSlots?: number;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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

function formatModelName(model: string): string {
	const parts = model.split("/");
	return parts.length > 1 ? parts[1] : model;
}

function formatCost(cost: number): string {
	return `$${cost.toFixed(7).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function formatSlot(slot: Slot, selected: boolean): string[] {
	if (slot.status === "pending") {
		return [];
	}

	const candidate = slot.candidate;
	const title = candidate.content.split("\n")[0]?.trim() || "";

	const modelInfo = candidate.model
		? candidate.cost
			? `${formatModelName(candidate.model)} ${formatCost(candidate.cost)}`
			: formatModelName(candidate.model)
		: "";

	if (selected) {
		const radio = "●";
		const line = `  ${radio}  ${theme.bold}${title}${theme.reset}`;
		const meta = modelInfo
			? `     ${theme.progress}${modelInfo}${theme.reset}`
			: "";
		return meta ? [line, meta] : [line];
	}

	const radio = "○";
	const line = `${theme.dim}  ${radio}  ${title}${theme.reset}`;
	const meta = modelInfo ? `${theme.dim}     ${modelInfo}${theme.reset}` : "";
	return meta ? [line, meta] : [line];
}

interface RenderState {
	slots: Slot[];
	selectedIndex: number;
	isGenerating: boolean;
	spinnerFrame: number;
	totalSlots: number;
}

let lastRenderLineCount = 0;
let activeCleanup: (() => void) | null = null;

export function clearRenderedOutput(): void {
	if (activeCleanup) {
		activeCleanup();
		activeCleanup = null;
	}
	if (lastRenderLineCount > 0) {
		process.stdout.write(`\x1b[${lastRenderLineCount}A`);
		process.stdout.write("\x1b[0J");
		lastRenderLineCount = 0;
	}
}

function render(state: RenderState): void {
	const { slots, selectedIndex, isGenerating, spinnerFrame, totalSlots } =
		state;

	if (lastRenderLineCount > 0) {
		process.stdout.write(`\x1b[${lastRenderLineCount}A`);
		process.stdout.write("\x1b[0J");
	}

	const lines: string[] = [];
	const readyCount = slots.filter((s) => s.status === "ready").length;

	if (isGenerating) {
		const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
		const progress = `${readyCount}/${totalSlots}`;
		lines.push(
			`${theme.progress}${spinner}${theme.reset} ${theme.primary}Generating commit messages... ${progress}${theme.reset}`,
		);
	} else {
		const label =
			readyCount === 1
				? "1 commit message generated"
				: `${readyCount} commit messages generated`;
		lines.push(ui.success(label));
	}

	const hasReady = readyCount > 0;
	if (hasReady) {
		const hint = ui.hint("↑↓ navigate  ⏎ confirm  e edit  r reroll  q quit");
		lines.push(ui.prompt(`Select a commit message ${hint}`));
	} else {
		lines.push(ui.hint("  q quit"));
	}

	lines.push("");

	for (let i = 0; i < slots.length; i++) {
		const slotLines = formatSlot(slots[i], i === selectedIndex);
		for (const line of slotLines) {
			lines.push(line);
		}
		if (slotLines.length > 0) {
			lines.push("");
		}
	}

	for (const line of lines) {
		console.log(line);
	}
	lastRenderLineCount = lines.length;
}

function renderError(error: unknown, slots: Slot[], totalSlots: number): void {
	const readyCount = slots.filter((s) => s.status === "ready").length;
	const message =
		error instanceof Error ? error.message : String(error ?? "Unknown error");

	const lines = [
		ui.blocked(`Generating commit messages... ${readyCount}/${totalSlots}`),
		"",
		`${theme.fatal}Error: ${message}${theme.reset}`,
	];

	for (const line of lines) {
		console.log(line);
	}
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
	const { createCandidates, maxSlots = 4 } = options;
	const abortController = new AbortController();
	const candidates = createCandidates(abortController.signal);

	if (!canUseInteractive()) {
		const iterator = candidates[Symbol.asyncIterator]();
		const firstResult = await iterator.next();
		abortController.abort();
		await iterator.return?.();
		return {
			action: "confirm",
			selected: firstResult.value?.content,
			selectedIndex: 0,
			selectedCandidate: firstResult.value,
		};
	}

	const slots: Slot[] = Array.from({ length: maxSlots }, () => ({
		status: "pending",
	}));
	return selectFromSlots(slots, { candidates, abortController });
}

interface AsyncContext {
	candidates: AsyncIterable<CandidateWithModel>;
	abortController: AbortController;
}

async function selectFromSlots(
	initialSlots: Slot[],
	asyncCtx: AsyncContext | null,
): Promise<SelectorResult> {
	return new Promise((resolve) => {
		let selectedIndex = 0;
		const slots = [...initialSlots];
		const totalSlots = initialSlots.length;
		let isGenerating = asyncCtx !== null;
		let spinnerFrame = 0;
		let spinnerInterval: ReturnType<typeof setInterval> | null = null;
		let cleanedUp = false;

		const fd = openSync("/dev/tty", "r");
		const ttyInput = new tty.ReadStream(fd);

		const rl = readline.createInterface({
			input: ttyInput,
			output: process.stdout,
			terminal: true,
		});

		readline.emitKeypressEvents(ttyInput, rl);
		ttyInput.setRawMode(true);

		const doRender = () => {
			if (cleanedUp) return;
			render({ slots, selectedIndex, isGenerating, spinnerFrame, totalSlots });
		};

		doRender();

		if (isGenerating) {
			spinnerInterval = setInterval(() => {
				spinnerFrame++;
				doRender();
			}, 80);
		}

		const cleanup = () => {
			if (cleanedUp) return;
			cleanedUp = true;
			activeCleanup = null;
			asyncCtx?.abortController.abort();
			if (spinnerInterval) {
				clearInterval(spinnerInterval);
				spinnerInterval = null;
			}
			ttyInput.setRawMode(false);
			rl.close();
			ttyInput.destroy();
			if (lastRenderLineCount > 0) {
				process.stdout.write(`\x1b[${lastRenderLineCount}A`);
				process.stdout.write("\x1b[0J");
			}
			lastRenderLineCount = 0;
		};

		activeCleanup = cleanup;

		if (asyncCtx) {
			const iterator = asyncCtx.candidates[Symbol.asyncIterator]();
			(async () => {
				let i = 0;
				try {
					while (true) {
						if (cleanedUp) break;
						const abortPromise = new Promise<{ done: true; value: undefined }>(
							(res) => {
								asyncCtx.abortController.signal.addEventListener(
									"abort",
									() => res({ done: true, value: undefined }),
									{ once: true },
								);
							},
						);
						const result = await Promise.race([iterator.next(), abortPromise]);
						if (result.done || cleanedUp) break;
						const candidate = result.value;
						if (i < slots.length) {
							slots[i] = { status: "ready", candidate };
							if (
								selectedIndex >= slots.length ||
								slots[selectedIndex].status === "pending"
							) {
								selectedIndex = i;
							}
							doRender();
							i++;
						}
					}
					if (cleanedUp) return;
					const readySlots = slots.filter((s) => s.status === "ready");
					slots.length = readySlots.length;
					for (let j = 0; j < readySlots.length; j++) {
						slots[j] = readySlots[j];
					}
					if (selectedIndex >= slots.length) {
						selectedIndex = Math.max(0, slots.length - 1);
					}
					isGenerating = false;
					if (spinnerInterval) {
						clearInterval(spinnerInterval);
						spinnerInterval = null;
					}
					doRender();
				} catch (err) {
					if (
						asyncCtx?.abortController.signal.aborted ||
						(err instanceof Error && err.name === "AbortError")
					) {
						return;
					}
					if (!cleanedUp) {
						cleanup();
						renderError(err, slots, totalSlots);
						resolve({ action: "abort" });
					}
				} finally {
					iterator.return?.();
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
					selectedCandidate: candidate,
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
				doRender();
				return;
			}

			if (key.name === "up" || key.name === "k") {
				for (let i = selectedIndex - 1; i >= 0; i--) {
					if (slots[i]?.status === "ready") {
						selectedIndex = i;
						doRender();
						break;
					}
				}
				return;
			}

			if (key.name === "down" || key.name === "j") {
				for (let i = selectedIndex + 1; i < slots.length; i++) {
					if (slots[i]?.status === "ready") {
						selectedIndex = i;
						doRender();
						break;
					}
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
				doRender();
				return;
			}
		};

		ttyInput.on("keypress", handleKeypress);
	});
}
