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
	getLatestQuota,
	getSelectedCandidate,
	getTotalCost,
	hasReadySlot,
	selectNearestReady,
} from "../../shared/terminal-selector-helpers";
import {
	buildSelectorViewModel,
	formatSelectorHintActions,
	type SelectorHintAction,
	type SelectorSlotViewModel,
} from "../../shared/terminal-selector-view-model";
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
const CLI_HINT_GROUPS: SelectorHintAction[][] = [
	["navigate", "confirm", "clickConfirm"],
	["edit", "refine"],
	["quit"],
];

function collapseToReady(slots: SelectorSlot[]): void {
	const readySlots = slots.filter((s) => s.status === "ready");
	slots.length = 0;
	for (const slot of readySlots) {
		slots.push(slot);
	}
}

function renderSlotMeta(meta: string, muted: boolean): string {
	return muted
		? `${theme.dim}${meta}${theme.reset}`
		: `${theme.primary}${meta}${theme.reset}`;
}

function renderCliSlotLines(slot: SelectorSlotViewModel): string[] {
	const radio = slot.selected
		? `${theme.success}${slot.radio}${theme.reset}`
		: `${theme.dim}${slot.radio}${theme.reset}`;
	const linePrefix = `  ${radio} `;

	if (slot.status === "ready" && slot.selected) {
		const line = `${linePrefix}${theme.primary}${theme.bold}${slot.title}${theme.reset}`;
		const meta = slot.meta ? `    ${renderSlotMeta(slot.meta, false)}` : "";
		return meta ? [line, meta] : [line];
	}

	const line = `${linePrefix}${theme.dim}${slot.title}${theme.reset}`;
	const meta = slot.meta ? `    ${renderSlotMeta(slot.meta, true)}` : "";
	return meta ? [line, meta] : [line];
}

const READY_REQUIRED_ACTIONS = new Set<SelectorHintAction>([
	"navigate",
	"confirm",
	"clickConfirm",
	"edit",
	"refine",
]);

function renderCliHintLine(
	actions: SelectorHintAction[],
	readyCount: number,
): string {
	const actionSet = new Set(actions);
	const renderedGroups = CLI_HINT_GROUPS.map((group) =>
		group
			.filter((action) => actionSet.has(action))
			.map((action) => {
				const label = formatSelectorHintActions([action], "cli");
				if (
					(READY_REQUIRED_ACTIONS.has(action) && readyCount <= 0) ||
					(action === "navigate" && readyCount <= 1)
				) {
					return `${theme.dim}${label}${theme.reset}`;
				}
				return `${theme.primary}${label}${theme.reset}`;
			})
			.join(" "),
	).filter((groupText) => groupText !== "");
	const separator = ` ${theme.primary}|${theme.reset} `;
	return `  ${renderedGroups.join(separator)}`;
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
	const lines: string[] = [];
	const viewModel = buildSelectorViewModel({
		state,
		nowMs,
		spinnerFrames: SPINNER_FRAMES,
		editedSelections,
		capabilities: {
			edit: true,
			refine: true,
		},
	});
	const costSuffix = viewModel.header.totalCostLabel
		? ` (total: ${viewModel.header.totalCostLabel})`
		: "";

	if (viewModel.header.mode === "running") {
		lines.push(
			`${theme.progress}${viewModel.header.spinner}${theme.reset} ${theme.primary}${viewModel.header.runningLabel} ${viewModel.header.progress}${costSuffix}${theme.reset}`,
		);
	} else {
		lines.push(ui.success(`${viewModel.header.generatedLabel}${costSuffix}`));
	}
	lines.push("");

	for (const slot of viewModel.slots) {
		const slotLines = renderCliSlotLines(slot);
		for (const line of slotLines) {
			lines.push(line);
		}
		if (slotLines.length > 0) {
			lines.push("");
		}
	}
	const readyCount = viewModel.slots.filter(
		(slot) => slot.status === "ready",
	).length;
	lines.push(renderCliHintLine(viewModel.hint.actions, readyCount));
	if (viewModel.editedSummary) {
		lines.push(ui.success(`Edited: ${viewModel.editedSummary}`));
		lines.push("");
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
		let isEditorOpen = false;

		const ttyInput = ttyIo.input;
		const ttyOutput = ttyIo.output;
		const renderer = createRenderer(ttyOutput);

		readline.emitKeypressEvents(ttyInput);
		ttyInput.setRawMode(true);

		const setRawModeSafe = (enabled: boolean) => {
			try {
				ttyInput.setRawMode(enabled);
			} catch {
				// Ignore tty mode errors during shutdown.
			}
		};

		const doRender = () => {
			if (!cleanedUp && !isEditorOpen) {
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

			if (clearOutput) {
				const viewModel = buildSelectorViewModel({
					state,
					nowMs: Date.now(),
					spinnerFrames: SPINNER_FRAMES,
					editedSelections,
					capabilities: { edit: true, refine: true },
				});
				const costSuffix = viewModel.header.totalCostLabel
					? ` (total: ${viewModel.header.totalCostLabel})`
					: "";
				const selectedTitle =
					selectedContent.split("\n")[0]?.trim() || selectedContent;
				renderer.clearAll();
				ttyOutput.write(
					`${ui.success(`${viewModel.header.generatedLabel}${costSuffix}`)}\n`,
				);
				ttyOutput.write(`${ui.success(`Selected: ${selectedTitle}`)}\n`);
			}

			resolveOnce({
				action: "confirm",
				selected: selectedContent,
				selectedIndex: state.selectedIndex,
				selectedCandidate: candidate,
				totalCost: totalCost > 0 ? totalCost : undefined,
				quota,
			});
			cleanup(false);
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
			isEditorOpen = true;
			if (state.isGenerating) {
				finalizeGeneration();
			}

			ttyInput.removeListener("keypress", handleKeypress);
			setRawModeSafe(false);
			ttyInput.pause();

			let edited = candidate.content;
			try {
				const result = await openEditor(candidate.content);
				edited = result || candidate.content;
			} catch {
				// Keep existing content when editor exits non-zero.
			} finally {
				isEditorOpen = false;
			}

			editedSelections.set(candidate.slotId, edited);
			renderer.reset();
			doRender();
			renderer.flush();
			setImmediate(() => {
				if (!cleanedUp) {
					confirmSelection(false);
				}
			});
		};

		const refineSelection = async () => {
			if (!hasReadySlot(slots)) return;
			ttyInput.off("keypress", handleKeypress);
			renderer.flush();
			ttyInput.setRawMode(false);

			const guide = await new Promise<string | null>((resolve) => {
				const prompt = `${ui.prompt(
					`Enter refine instructions (e.g., more formal / shorter / Enter to clear): `,
				)}`;
				const promptReader = readline.createInterface({
					input: ttyInput,
					output: ttyOutput,
					terminal: true,
				});

				let resolved = false;
				const finish = (value: string | null) => {
					if (resolved) return;
					resolved = true;
					promptReader.close();
					resolve(value);
				};

				promptReader.on("SIGINT", () => {
					finish(null);
				});
				promptReader.question(prompt, (input) => {
					finish(input.trim());
				});
			});

			ttyInput.setRawMode(true);
			ttyInput.on("keypress", handleKeypress);
			renderer.reset();
			if (guide === null) return;
			cancelGeneration();
			resolveOnce({ action: "refine", guide });
			cleanup();
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

			if (key.name === "r" && (key.shift || key.sequence === "R")) {
				await refineSelection();
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
