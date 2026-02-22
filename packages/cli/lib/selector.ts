import { spawn } from "node:child_process";
import {
	accessSync,
	constants,
	mkdtempSync,
	openSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as readline from "node:readline";
import * as tty from "node:tty";
import type {
	SelectorSlot,
	CandidateWithModel as SharedCandidateWithModel,
	QuotaInfo as SharedQuotaInfo,
	SelectorResult as SharedSelectorResult,
} from "../../shared/terminal-selector-contract";
import {
	formatCost,
	formatModelName,
	formatTotalCostLabel,
	getLatestQuota,
	getReadyCount,
	getSelectedCandidate,
	getTotalCost,
	hasReadySlot,
	selectNearestReady,
} from "../../shared/terminal-selector-helpers";
import { InvalidModelError } from "./api-client";
import { createRenderer, SPINNER_FRAMES } from "./renderer";
import { theme } from "./theme";
import { ui } from "./ui";

export type CandidateWithModel = SharedCandidateWithModel;
export type QuotaInfo = SharedQuotaInfo;
export type SelectorResult = SharedSelectorResult;

interface SelectorOptions {
	createCandidates: (signal: AbortSignal) => AsyncIterable<CandidateWithModel>;
	maxSlots?: number;
	abortSignal?: AbortSignal;
	models?: string[];
}

const TTY_PATH = "/dev/tty";

function collapseToReady(slots: SelectorSlot[]): void {
	const readySlots = slots.filter((s) => s.status === "ready");
	slots.length = 0;
	for (const slot of readySlots) {
		slots.push(slot);
	}
}

function formatSlot(slot: SelectorSlot, selected: boolean): string[] {
	if (slot.status === "pending") {
		const radio = "○";
		const line = `${theme.dim}  ${radio}  Generating...${theme.reset}`;
		const meta = slot.model
			? `${theme.dim}     ${formatModelName(slot.model)}${theme.reset}`
			: "";
		return meta ? [line, meta] : [line];
	}

	if (slot.status === "error") {
		const radio = "○";
		const line = `${theme.dim}  ${radio}  ${slot.content}${theme.reset}`;
		return [line];
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
	slots: SelectorSlot[];
	selectedIndex: number;
	isGenerating: boolean;
	totalSlots: number;
}

function renderSelector(
	state: RenderState,
	nowMs: number,
	renderer: ReturnType<typeof createRenderer>,
	editedSelections?: Map<string, string>,
): void {
	const { slots, selectedIndex, isGenerating, totalSlots } = state;

	const lines: string[] = [];
	const readyCount = getReadyCount(slots);
	const totalCost = getTotalCost(slots);
	const costSuffix =
		totalCost > 0 ? ` (total: ${formatTotalCostLabel(totalCost)})` : "";

	if (isGenerating) {
		const frameIndex = Math.floor(nowMs / 80) % SPINNER_FRAMES.length;
		const spinner = SPINNER_FRAMES[frameIndex];
		const progress = `${readyCount}/${totalSlots}`;
		lines.push(
			`${theme.progress}${spinner}${theme.reset} ${theme.primary}Generating commit messages... ${progress}${costSuffix}${theme.reset}`,
		);
	} else {
		const label =
			readyCount === 1
				? `1 commit message generated${costSuffix}`
				: `${readyCount} commit messages generated${costSuffix}`;
		lines.push(ui.success(label));
	}

	const selectedSlot = slots[selectedIndex];
	const isEditedSelection =
		selectedSlot?.status === "ready" &&
		editedSelections?.has(selectedSlot.candidate.slotId) === true;

	const hasReady = readyCount > 0;
	if (hasReady) {
		if (isEditedSelection) {
			lines.push(ui.success("Select a commit message"));
		} else {
			const hint = ui.hint("↑↓ navigate  ⏎ confirm  e edit  r reroll  q quit");
			lines.push(ui.prompt(`Select a commit message ${hint}`));
		}
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
	if (selectedSlot?.status === "ready") {
		const edited = editedSelections?.get(selectedSlot.candidate.slotId);
		if (edited) {
			const editedSummary = edited.split("\n")[0]?.slice(0, 120);
			lines.push(ui.success(`Edited: ${editedSummary}`));
			lines.push("");
		}
	}

	renderer.render(`${lines.join("\n")}\n`);
}

function renderError(
	error: unknown,
	slots: SelectorSlot[],
	totalSlots: number,
	output: tty.WriteStream,
): void {
	const readyCount = slots.filter((s) => s.status === "ready").length;
	const message =
		error instanceof Error ? error.message : String(error ?? "Unknown error");

	const lines = [
		ui.blocked(`Generating commit messages... ${readyCount}/${totalSlots}`),
		"",
		`${theme.fatal}Error: ${message}${theme.reset}`,
	];

	for (const line of lines) {
		output.write(`${line}\n`);
	}
}

function openEditor(content: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const editor = process.env.GIT_EDITOR || process.env.EDITOR || "vi";
		const tmpDir = mkdtempSync(join(tmpdir(), "ultrahope-"));
		const tmpFile = join(tmpDir, "EDIT_MESSAGE");
		let cleanupDone = false;

		const cleanupTempArtifacts = () => {
			if (cleanupDone) return;
			cleanupDone = true;
			try {
				rmSync(tmpDir, { recursive: true, force: true });
			} catch {}
		};

		try {
			writeFileSync(tmpFile, content);

			const child = spawn(editor, [tmpFile], { stdio: "inherit" });

			child.on("close", (code) => {
				try {
					if (code !== 0) {
						reject(new Error(`Editor exited with code ${code}`));
						return;
					}
					const result = readFileSync(tmpFile, "utf-8").trim();
					resolve(result);
				} catch (err) {
					reject(err);
				} finally {
					cleanupTempArtifacts();
				}
			});

			child.on("error", (err) => {
				cleanupTempArtifacts();
				reject(err);
			});
		} catch (err) {
			cleanupTempArtifacts();
			reject(err);
		}
	});
}

export async function selectCandidate(
	options: SelectorOptions,
): Promise<SelectorResult> {
	const { createCandidates, maxSlots = 4, abortSignal, models } = options;
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

	let ttyInput: tty.ReadStream | null = null;
	let ttyOutput: tty.WriteStream | null = null;
	try {
		accessSync(TTY_PATH, constants.R_OK | constants.W_OK);
		if (process.stdin.isTTY) {
			ttyInput = process.stdin as tty.ReadStream;
		} else {
			const inputFd = openSync(TTY_PATH, "r");
			ttyInput = new tty.ReadStream(inputFd);
		}
		// Use process.stdout if it's a TTY, otherwise open /dev/tty
		// This works around a Bun bug with tty.WriteStream and kqueue
		if (process.stdout.isTTY) {
			ttyOutput = process.stdout as tty.WriteStream;
		} else {
			const outputFd = openSync(TTY_PATH, "w");
			ttyOutput = new tty.WriteStream(outputFd);
		}
	} catch {
		console.error(
			"Error: /dev/tty is not available. Use --no-interactive for non-interactive mode.",
		);
		process.exit(1);
	}
	if (!ttyInput || !ttyOutput) {
		console.error(
			"Error: /dev/tty is not available. Use --no-interactive for non-interactive mode.",
		);
		process.exit(1);
	}

	const slots: SelectorSlot[] = Array.from({ length: maxSlots }, (_, i) => ({
		status: "pending",
		slotId: models?.[i] ?? `slot-${i}`,
		model: models?.[i],
	}));
	return selectFromSlots(
		slots,
		{ candidates, abortController, abortSignal },
		{ input: ttyInput, output: ttyOutput },
	);
}

interface AsyncContext {
	candidates: AsyncIterable<CandidateWithModel>;
	abortController: AbortController;
	abortSignal?: AbortSignal;
}

async function selectFromSlots(
	initialSlots: SelectorSlot[],
	asyncCtx: AsyncContext | null,
	ttyIo: { input: tty.ReadStream; output: tty.WriteStream },
): Promise<SelectorResult> {
	return new Promise((resolve) => {
		let resolved = false;
		const resolveOnce = (result: SelectorResult) => {
			if (resolved) return;
			resolved = true;
			resolve(result);
		};

		const slots = [...initialSlots];
		const editedSelections = new Map<string, string>();
		const state: RenderState = {
			slots,
			selectedIndex: 0,
			isGenerating: asyncCtx !== null,
			totalSlots: initialSlots.length,
		};
		let renderInterval: ReturnType<typeof setInterval> | null = null;
		let cleanedUp = false;

		const ttyInput = ttyIo.input;
		const ttyOutput = ttyIo.output;
		const renderer = createRenderer(ttyOutput);

		const rl = readline.createInterface({
			input: ttyInput,
			output: ttyOutput,
			terminal: true,
		});

		readline.emitKeypressEvents(ttyInput, rl);
		ttyInput.setRawMode(true);

		const setRawModeSafe = (enabled: boolean) => {
			try {
				ttyInput.setRawMode(enabled);
			} catch {
				// Ignore tty mode errors during shutdown.
			}
		};

		const doRender = () => {
			if (!cleanedUp) {
				renderSelector(state, Date.now(), renderer, editedSelections);
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

		const cancelGeneration = () => {
			asyncCtx?.abortController.abort();
		};

		const cleanup = (clearOutput = true) => {
			if (cleanedUp) return;
			cleanedUp = true;
			stopRenderLoop();
			if (clearOutput) {
				renderer.clearAll();
			}
			ttyInput.removeAllListeners("keypress");
			setRawModeSafe(false);
			rl.close();
			ttyInput.pause();
			if (ttyInput !== process.stdin && !ttyInput.destroyed) {
				ttyInput.destroy();
			}
			if (
				ttyOutput !== process.stdout &&
				ttyOutput !== process.stderr &&
				!ttyOutput.destroyed
			) {
				ttyOutput.destroy();
			}
		};

		const nextCandidate = async (
			iterator: AsyncIterator<CandidateWithModel>,
		): Promise<IteratorResult<CandidateWithModel>> => {
			if (!asyncCtx?.abortController) {
				return iterator.next();
			}
			const signal = asyncCtx.abortController.signal;
			if (signal.aborted) {
				return { done: true, value: undefined };
			}

			let cleanup = () => {};
			const abortPromise = new Promise<IteratorResult<CandidateWithModel>>(
				(resolve) => {
					const onAbort = () => resolve({ done: true, value: undefined });
					signal.addEventListener("abort", onAbort);
					cleanup = () => signal.removeEventListener("abort", onAbort);
				},
			);
			return Promise.race([iterator.next(), abortPromise]).finally(() => {
				cleanup();
			});
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
				try {
					while (!cleanedUp) {
						const result = await nextCandidate(iterator);
						if (result.done || cleanedUp) break;
						const candidate = result.value;
						const targetIndex = slots.findIndex((slot) => {
							if (slot.status === "ready") {
								return slot.candidate.slotId === candidate.slotId;
							}
							return (
								slot.status === "pending" && slot.slotId === candidate.slotId
							);
						});

						if (targetIndex >= 0 && targetIndex < slots.length) {
							const isNewSlot = slots[targetIndex].status === "pending";
							updateState((draft) => {
								slots[targetIndex] = { status: "ready", candidate };
								if (
									isNewSlot &&
									(draft.selectedIndex >= slots.length ||
										slots[draft.selectedIndex].status === "pending")
								) {
									draft.selectedIndex = targetIndex;
								}
							});
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
						cancelGeneration();
						if (err instanceof InvalidModelError) {
							cleanup();
							resolveOnce({ action: "abort", error: err });
							return;
						}
						renderer.clearAll();
						renderError(err, slots, state.totalSlots, ttyOutput);
						cleanup(false);
						resolveOnce({ action: "abort", error: err });
					}
				} finally {
					iterator.return?.();
				}
			})();
		}

		const confirmSelection = (clearOutput = true) => {
			const candidate = getSelectedCandidate(slots, state.selectedIndex);
			if (!candidate) return;
			const selectedContent =
				editedSelections.get(candidate.slotId) ?? candidate.content;
			cancelGeneration();
			const totalCost = getTotalCost(slots);
			const quota = getLatestQuota(slots);
			resolveOnce({
				action: "confirm",
				selected: selectedContent,
				selectedIndex: state.selectedIndex,
				selectedCandidate: candidate,
				totalCost: totalCost > 0 ? totalCost : undefined,
				quota,
			});
			cleanup(clearOutput);
		};

		const rerollSelection = () => {
			if (!hasReadySlot(slots)) return;
			cancelGeneration();
			resolveOnce({ action: "reroll" });
			cleanup();
		};

		const abortSelection = () => {
			cancelGeneration();
			cleanup();
			resolveOnce({ action: "abort" });
		};

		const editSelection = async () => {
			const candidate = getSelectedCandidate(slots, state.selectedIndex);
			if (!candidate) return;
			stopRenderLoop();
			cancelGeneration();
			if (state.isGenerating) {
				state.isGenerating = false;
			}

			ttyInput.removeListener("keypress", handleKeypress);
			rl.pause();
			setRawModeSafe(false);

			let edited = candidate.content;
			try {
				const result = await openEditor(candidate.content);
				edited = result || candidate.content;
			} catch {
				// Keep existing content when editor exits non-zero.
			}

			editedSelections.set(candidate.slotId, edited);
			doRender();
			renderer.flush();
			setImmediate(() => {
				if (!cleanedUp) {
					confirmSelection(false);
				}
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

		if (asyncCtx?.abortSignal) {
			if (asyncCtx.abortSignal.aborted) {
				abortSelection();
			} else {
				asyncCtx.abortSignal.addEventListener("abort", abortSelection, {
					once: true,
				});
			}
		}

		ttyInput.on("keypress", handleKeypress);
	});
}
