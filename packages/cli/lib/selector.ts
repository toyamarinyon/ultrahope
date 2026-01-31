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
import { clearAll, flush, render, reset, SPINNER_FRAMES } from "./renderer";
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
	abortSignal?: AbortSignal;
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

function formatModelName(model: string): string {
	const parts = model.split("/");
	return parts.length > 1 ? parts[1] : model;
}

function formatCost(cost: number): string {
	return `$${cost.toFixed(7).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function getReadyCount(slots: Slot[]): number {
	return slots.filter((s) => s.status === "ready").length;
}

function hasReadySlot(slots: Slot[]): boolean {
	return slots.some((s) => s.status === "ready");
}

function getSelectedCandidate(
	slots: Slot[],
	selectedIndex: number,
): CandidateWithModel | undefined {
	const slot = slots[selectedIndex];
	return slot?.status === "ready" ? slot.candidate : undefined;
}

function selectNearestReady(
	slots: Slot[],
	startIndex: number,
	direction: -1 | 1,
): number {
	for (
		let i = startIndex + direction;
		i >= 0 && i < slots.length;
		i += direction
	) {
		if (slots[i]?.status === "ready") {
			return i;
		}
	}
	return startIndex;
}

function collapseToReady(slots: Slot[]): void {
	const readySlots = slots.filter((s) => s.status === "ready");
	slots.length = 0;
	for (const slot of readySlots) {
		slots.push(slot);
	}
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
	totalSlots: number;
}

function renderSelector(state: RenderState, nowMs: number): void {
	const { slots, selectedIndex, isGenerating, totalSlots } = state;

	const lines: string[] = [];
	const readyCount = getReadyCount(slots);

	if (isGenerating) {
		const frameIndex = Math.floor(nowMs / 80) % SPINNER_FRAMES.length;
		const spinner = SPINNER_FRAMES[frameIndex];
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

	render(`${lines.join("\n")}\n`);
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
	const { createCandidates, maxSlots = 4, abortSignal } = options;
	const abortController = new AbortController();
	if (abortSignal?.aborted) {
		abortController.abort();
		return { action: "abort" };
	}

	if (abortSignal) {
		abortSignal.addEventListener("abort", () => abortController.abort(), {
			once: true,
		});
	}

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
		let resolved = false;
		const resolveOnce = (result: SelectorResult) => {
			if (resolved) return;
			resolved = true;
			resolve(result);
		};

		const slots = [...initialSlots];
		const state: RenderState = {
			slots,
			selectedIndex: 0,
			isGenerating: asyncCtx !== null,
			totalSlots: initialSlots.length,
		};
		let renderInterval: ReturnType<typeof setInterval> | null = null;
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
			if (!cleanedUp) {
				renderSelector(state, Date.now());
			}
		};

		const updateState = (update: (draft: RenderState) => void) => {
			update(state);
			doRender();
		};

		const startRenderLoop = () => {
			if (!state.isGenerating) return;
			renderInterval = setInterval(() => {
				doRender();
			}, 80);
		};

		const stopRenderLoop = () => {
			if (!renderInterval) return;
			clearInterval(renderInterval);
			renderInterval = null;
		};

		doRender();
		startRenderLoop();

		const cleanup = () => {
			if (cleanedUp) return;
			cleanedUp = true;
			asyncCtx?.abortController.abort();
			stopRenderLoop();
			ttyInput.setRawMode(false);
			rl.close();
			ttyInput.destroy();
			clearAll();
		};

		const nextCandidate = async (
			iterator: AsyncIterator<CandidateWithModel>,
		): Promise<IteratorResult<CandidateWithModel>> => {
			const abortPromise = new Promise<IteratorResult<CandidateWithModel>>(
				(resolve) => {
					asyncCtx?.abortController.signal.addEventListener(
						"abort",
						() => resolve({ done: true, value: undefined }),
						{ once: true },
					);
				},
			);
			return Promise.race([iterator.next(), abortPromise]);
		};

		const finalizeGeneration = () => {
			collapseToReady(slots);
			stopRenderLoop();
			updateState((draft) => {
				if (draft.selectedIndex >= slots.length) {
					draft.selectedIndex = Math.max(0, slots.length - 1);
				}
				draft.isGenerating = false;
			});
		};

		if (asyncCtx) {
			const iterator = asyncCtx.candidates[Symbol.asyncIterator]();
			(async () => {
				let i = 0;
				try {
					while (!cleanedUp) {
						const result = await nextCandidate(iterator);
						if (result.done || cleanedUp) break;
						const candidate = result.value;
						if (i < slots.length) {
							updateState((draft) => {
								slots[i] = { status: "ready", candidate };
								if (
									draft.selectedIndex >= slots.length ||
									slots[draft.selectedIndex].status === "pending"
								) {
									draft.selectedIndex = i;
								}
							});
							i++;
						}
					}
					if (cleanedUp) return;
					finalizeGeneration();
				} catch (err) {
					if (
						asyncCtx?.abortController.signal.aborted ||
						(err instanceof Error && err.name === "AbortError")
					) {
						return;
					}
					if (!cleanedUp) {
						cleanup();
						renderError(err, slots, state.totalSlots);
						resolveOnce({ action: "abort" });
					}
				} finally {
					iterator.return?.();
				}
			})();
		}

		const confirmSelection = () => {
			const candidate = getSelectedCandidate(slots, state.selectedIndex);
			if (!candidate) return;
			cleanup();
			resolveOnce({
				action: "confirm",
				selected: candidate.content,
				selectedIndex: state.selectedIndex,
				selectedCandidate: candidate,
			});
		};

		const rerollSelection = () => {
			if (!hasReadySlot(slots)) return;
			cleanup();
			resolveOnce({ action: "reroll" });
		};

		const abortSelection = () => {
			cleanup();
			resolveOnce({ action: "abort" });
		};

		const editSelection = async () => {
			const candidate = getSelectedCandidate(slots, state.selectedIndex);
			if (!candidate) return;
			flush();
			ttyInput.setRawMode(false);
			let edited: string | null = null;
			try {
				const result = await openEditor(candidate.content);
				edited = result ? result : null;
			} catch {}
			ttyInput.setRawMode(true);
			reset();
			updateState(() => {
				if (!edited) return;
				slots[state.selectedIndex] = {
					status: "ready",
					candidate: { ...candidate, content: edited },
				};
			});
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
				abortSelection();
				return;
			}

			if (key.name === "return") {
				confirmSelection();
				return;
			}

			if (key.name === "r") {
				rerollSelection();
				return;
			}

			if (key.name === "e") {
				await editSelection();
				return;
			}

			if (key.name === "up" || key.name === "k") {
				updateState((draft) => {
					draft.selectedIndex = selectNearestReady(
						slots,
						draft.selectedIndex,
						-1,
					);
				});
				return;
			}

			if (key.name === "down" || key.name === "j") {
				updateState((draft) => {
					draft.selectedIndex = selectNearestReady(
						slots,
						draft.selectedIndex,
						1,
					);
				});
				return;
			}

			const num = Number.parseInt(key.name || "", 10);
			if (
				num >= 1 &&
				num <= slots.length &&
				slots[num - 1]?.status === "ready"
			) {
				updateState((draft) => {
					draft.selectedIndex = num - 1;
				});
				return;
			}
		};

		if (asyncCtx) {
			asyncCtx.abortController.signal.addEventListener(
				"abort",
				abortSelection,
				{
					once: true,
				},
			);
		}

		ttyInput.on("keypress", handleKeypress);
	});
}
