import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as readline from "node:readline";
import type * as tty from "node:tty";
import type {
	ListMode,
	SelectorFlowContext,
	CandidateWithModel as SharedCandidateWithModel,
	QuotaInfo as SharedQuotaInfo,
	SelectorResult as SharedSelectorResult,
} from "../../shared/terminal-selector-contract";
import {
	applyCandidateToFlowContext,
	createInitialFlowContext,
	transitionSelectorFlow,
} from "../../shared/terminal-selector-flow";
import {
	getSelectedCandidate,
	hasReadySlot,
	normalizeCandidateContentForDisplay,
} from "../../shared/terminal-selector-helpers";
import { selectorRenderFrame } from "../../shared/terminal-selector-view-model";
import { InvalidModelError } from "./api-client";
import { editLine } from "./line-editor";
import {
	createRenderer,
	renderSelectorTextFromRenderFrame,
	SPINNER_FRAMES,
} from "./renderer";
import { theme } from "./theme";
import {
	cleanupTtyResources,
	createTtyReadStream,
	createTtyWriteStream,
	type StreamCleanup,
} from "./tty";
import { ui } from "./ui";

export type CandidateWithModel = SharedCandidateWithModel;
export type QuotaInfo = SharedQuotaInfo;
export type SelectorResult = SharedSelectorResult;

interface SelectorOptions {
	createCandidates: (
		signal: AbortSignal,
		guideHint?: string,
	) => AsyncIterable<CandidateWithModel>;
	maxSlots?: number;
	abortSignal?: AbortSignal;
	models?: string[];
	initialListMode?: ListMode;
	initialGuideHint?: string;
	inlineEditPrompt?: boolean;
	io?: {
		input: NodeJS.ReadableStream;
		output: NodeJS.WritableStream;
	};
}

const selectorRenderCopy = {
	runningLabel: "Generating commit messages...",
};

const selectorRenderCapabilities = {
	edit: true,
	refine: true,
	clickConfirm: false,
};

function renderError(
	error: unknown,
	slotsLength: number,
	output: NodeJS.WritableStream,
): void {
	const readyCount = slotsLength;
	const message =
		error instanceof Error ? error.message : String(error ?? "Unknown error");

	const lines = [
		ui.blocked(`Generating commit messages... ${readyCount}/${slotsLength}`),
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
	const {
		createCandidates,
		maxSlots = 4,
		abortSignal,
		models,
		initialListMode = "initial",
		initialGuideHint,
		inlineEditPrompt = false,
		io,
	} = options;
	const abortController = new AbortController();
	if (abortSignal?.aborted) {
		abortController.abort();
		return { action: "abort", abortReason: "exit" };
	}

	if (abortSignal) {
		abortSignal.addEventListener("abort", () => abortController.abort(), {
			once: true,
		});
	}

	const candidates = createCandidates;

	let ttyInput: NodeJS.ReadableStream | null = null;
	let ttyOutput: NodeJS.WritableStream | null = null;
	const ttyResources: StreamCleanup[] = [];
	if (io) {
		ttyInput = io.input;
		ttyOutput = io.output;
	} else {
		try {
			if (process.stdin.isTTY) {
				ttyInput = process.stdin as tty.ReadStream;
			} else {
				const { stream, cleanup } = createTtyReadStream();
				ttyInput = stream;
				ttyResources.push(cleanup);
			}
			if (process.stdout.isTTY) {
				ttyOutput = process.stdout as tty.WriteStream;
			} else {
				const { stream, cleanup } = createTtyWriteStream();
				ttyOutput = stream;
				ttyResources.push(cleanup);
			}
		} catch {
			cleanupTtyResources(ttyResources);
			console.error(
				"Error: /dev/tty is not available. Interactive mode requires a terminal.",
			);
			process.exit(1);
		}
	}
	if (!ttyInput || !ttyOutput) {
		cleanupTtyResources(ttyResources);
		console.error(
			"Error: /dev/tty is not available. Interactive mode requires a terminal.",
		);
		process.exit(1);
	}
	const ownsTtyResources = ttyResources.length > 0;

	const initialSlots: SelectorFlowContext["slots"] = Array.from(
		{ length: maxSlots },
		(_, i) => ({
			status: "pending",
			slotId: models?.[i] ?? `slot-${i}`,
			model: models?.[i],
		}),
	);

	return new Promise((resolve) => {
		let resolved = false;
		const resolveOnce = (result: SelectorResult) => {
			if (resolved) return;
			resolved = true;
			resolve(result);
		};

		const initialContext = createInitialFlowContext({
			slots: initialSlots,
			totalSlots: maxSlots,
			listMode: initialListMode,
			guideHint: initialGuideHint,
		});
		let context = initialContext;
		let renderInterval: ReturnType<typeof setInterval> | null = null;
		let cleanedUp = false;
		let generationRun = 0;
		let generationController: AbortController | null = null;
		let isPromptOpen = false;

		const ttyReader = ttyInput;
		const ttyWriter = ttyOutput;
		const renderer = createRenderer(ttyWriter as NodeJS.WriteStream);

		const setRawModeSafe = (enabled: boolean) => {
			try {
				const r = ttyReader as unknown as {
					setRawMode?: (enabled: boolean) => void;
				};
				r.setRawMode?.(enabled);
			} catch {
				// Ignore tty mode errors during shutdown.
			}
		};

		readline.emitKeypressEvents(ttyReader);
		setRawModeSafe(true);
		ttyReader.resume();

		const render = () => {
			const allowPromptRender =
				context.mode === "prompt" && context.promptKind === "edit";
			if (!cleanedUp && (!isPromptOpen || allowPromptRender)) {
				const frame = selectorRenderFrame({
					state: {
						...context,
						mode: context.mode,
						promptKind: context.promptKind,
						promptTargetIndex: context.promptTargetIndex,
					},
					nowMs: Date.now(),
					spinnerFrames: SPINNER_FRAMES,
					copy: selectorRenderCopy,
					capabilities: selectorRenderCapabilities,
				});
				renderer.render(renderSelectorTextFromRenderFrame(frame));
			}
		};

		const renderFinalSelection = (result: SelectorResult) => {
			const frame = selectorRenderFrame({
				state: {
					...context,
					mode: context.mode,
					promptKind: context.promptKind,
					promptTargetIndex: context.promptTargetIndex,
				},
				nowMs: Date.now(),
				spinnerFrames: SPINNER_FRAMES,
				copy: selectorRenderCopy,
				capabilities: selectorRenderCapabilities,
			});
			const selected =
				result.selectedCandidate?.content ?? result.selected ?? "";
			const selectedTitle =
				normalizeCandidateContentForDisplay(selected) || selected;
			const costSuffix = frame.viewModel.header.totalCostLabel
				? ` (total: ${frame.viewModel.header.totalCostLabel})`
				: "";
			const generatedLine = `${frame.viewModel.header.generatedLabel}${costSuffix}`;
			const lines = [ui.success(generatedLine)];

			if (selectedTitle) {
				lines.push(ui.success(`Selected: ${selectedTitle}`));
			}
			if (result.edited) {
				const editedTitle = normalizeCandidateContentForDisplay(selected);
				if (editedTitle) {
					lines.push(ui.success(`Edited ${editedTitle}`));
				}
			}

			renderer.clearAll();
			ttyWriter.write(`${lines.join("\n")}\n`);
		};

		const stopRenderLoop = () => {
			if (!renderInterval) return;
			clearInterval(renderInterval);
			renderInterval = null;
		};

		const startRenderLoop = () => {
			if (!context.isGenerating) return;
			if (renderInterval) return;
			renderInterval = setInterval(() => {
				render();
			}, 80);
		};

		const cleanup = (clearOutput = true) => {
			if (cleanedUp) return;
			cleanedUp = true;
			cancelGeneration();
			stopRenderLoop();
			cleanupTtyResources(ttyResources);
			if (clearOutput) {
				renderer.clearAll();
			}
			ttyReader.removeAllListeners("keypress");
			setRawModeSafe(false);
			ttyReader.pause();
			if (!ownsTtyResources) {
				const reader = ttyReader as unknown as {
					destroyed?: boolean;
					destroy?(): void;
				};
				if (
					ttyReader !== (process.stdin as NodeJS.ReadableStream) &&
					!reader.destroyed
				) {
					reader.destroy?.();
				}
				const writer = ttyWriter as unknown as {
					destroyed?: boolean;
					destroy?(): void;
				};
				if (
					ttyWriter !== (process.stdout as NodeJS.WritableStream) &&
					ttyWriter !== (process.stderr as NodeJS.WritableStream) &&
					!writer.destroyed
				) {
					writer.destroy?.();
				}
			}
		};

		const cancelGeneration = () => {
			if (generationController) {
				generationController.abort();
				generationController = null;
			}
		};

		const nextCandidate = async (
			iterator: AsyncIterator<CandidateWithModel>,
		): Promise<IteratorResult<CandidateWithModel>> => {
			if (!generationController) {
				return iterator.next();
			}
			const signal = generationController.signal;
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

		const applyResult = (
			transitionResult: ReturnType<typeof transitionSelectorFlow>,
		) => {
			context = transitionResult.context;
			if (transitionResult.effects.length > 0) {
				for (const effect of transitionResult.effects) {
					if (effect.type === "cancelGeneration") {
						cancelGeneration();
						context.isGenerating = false;
						stopRenderLoop();
					}
					if (effect.type === "startGeneration") {
						startGeneration();
					}
				}
			}
			if (transitionResult.context.isGenerating) {
				startRenderLoop();
			} else {
				stopRenderLoop();
			}
			if (transitionResult.result) {
				const result = transitionResult.result;
				if (result.action === "confirm") {
					renderFinalSelection(result);
					resolveOnce(result);
					cleanup(false);
					return;
				}
				if (result.action === "refine") {
					resolveOnce(result);
					cleanup(false);
					return;
				}
				if (result.action === "abort") {
					resolveOnce(result);
					cleanup(false);
					return;
				}
			}
			render();
		};

		const startGeneration = () => {
			cancelGeneration();
			generationController = new AbortController();
			const runId = ++generationRun;
			const iterator = candidates(
				generationController.signal,
				context.guideHint,
			)[Symbol.asyncIterator]();
			const signal = generationController.signal;

			startRenderLoop();
			const run = async () => {
				try {
					while (!cleanedUp) {
						const result = await nextCandidate(iterator);
						if (result.done || cleanedUp || runId !== generationRun) {
							break;
						}
						const candidate = result.value;
						context = applyCandidateToFlowContext(context, candidate);
						render();
					}
					if (cleanedUp || runId !== generationRun || signal.aborted) {
						return;
					}
					applyResult(
						transitionSelectorFlow(context, {
							type: "GENERATE_DONE",
						}),
					);
				} catch (error) {
					if (runId !== generationRun) return;
					if (signal.aborted) return;
					if (error instanceof Error && error.name === "AbortError") return;
					if (error instanceof InvalidModelError) {
						cleanup();
						resolveOnce({ action: "abort", error });
						return;
					}
					if (!cleanedUp) {
						cancelGeneration();
						renderer.clearAll();
						renderError(error, context.slots.length, ttyWriter);
						cleanup(false);
						resolveOnce({ action: "abort", error });
					}
				} finally {
					if (!cleanedUp) {
						try {
							await iterator.return?.();
						} catch {}
					}
				}
			};

			run();
		};

		const renderForPrompt = () => {
			// Reconstruct entire selector frame after prompt mode to avoid accumulating
			// renderer state with inline-edit cursor movements.
			renderer.clearAll();
			render();
		};

		const withPromptSuspended = async (
			task: () => Promise<void>,
			options: { preserveRendererOutput?: boolean } = {},
		) => {
			if (isPromptOpen || cleanedUp) return;
			isPromptOpen = true;
			stopRenderLoop();
			if (!options.preserveRendererOutput) {
				renderer.clearAll();
			}
			setRawModeSafe(false);
			ttyReader.removeListener("keypress", handleKeypress);
			await task();
			if (cleanedUp) return;
			isPromptOpen = false;
			ttyReader.resume();
			ttyReader.on("keypress", handleKeypress);
			setRawModeSafe(true);
			renderForPrompt();
		};

		const openRefinePrompt = async () => {
			await withPromptSuspended(async () => {
				let lastRefineLineRow = 0;

				const guide = await editLine({
					input: ttyReader,
					output: ttyWriter,
					prefix: "",
					initialValue: "",
					finalizeMode: "none",
					onRender: ({ buffer }) => {
						if (lastRefineLineRow > 0) {
							readline.moveCursor(ttyWriter, 0, -lastRefineLineRow);
						}
						readline.cursorTo(ttyWriter, 0);
						readline.clearScreenDown(ttyWriter);

						const frame = selectorRenderFrame({
							state: {
								...context,
								mode: "list",
								promptKind: context.promptKind,
								promptTargetIndex: context.promptTargetIndex,
							},
							nowMs: Date.now(),
							spinnerFrames: SPINNER_FRAMES,
							copy: selectorRenderCopy,
							capabilities: selectorRenderCapabilities,
						});

						const lines: string[] = [];
						const vm = frame.viewModel;
						const costSuffix = vm.header.totalCostLabel
							? ` (total: ${vm.header.totalCostLabel})`
							: "";
						lines.push(ui.success(`${vm.header.generatedLabel}${costSuffix}`));
						lines.push("");

						for (const slot of vm.slots) {
							const radio = slot.selected
								? `${theme.success}●${theme.reset}`
								: `${theme.dim}○${theme.reset}`;
							const titleColor = slot.selected ? theme.primary : theme.dim;
							const titleFont = slot.selected ? theme.bold : "";
							lines.push(
								`  ${radio} ${titleColor}${titleFont}${slot.title}${theme.reset}`,
							);
							if (slot.meta) {
								const metaColor = slot.selected ? theme.primary : theme.dim;
								lines.push(`    ${metaColor}${slot.meta}${theme.reset}`);
							}
							lines.push("");
						}

						const refineLineIndex = lines.length;
						const refinePrefix = `  ${theme.primary}Refine:${theme.reset} `;
						lines.push(`${refinePrefix}${buffer.getText()}`);
						lines.push(
							`  ${theme.dim}e.g. more formal / shorter / in Japanese${theme.reset}`,
						);
						lines.push("");
						lines.push(`  ${ui.hint("enter refine | esc back to select")}`);
						ttyWriter.write(lines.join("\n"));

						const moveUp = lines.length - 1 - refineLineIndex;
						if (moveUp > 0) {
							readline.moveCursor(ttyWriter, 0, -moveUp);
						}
						readline.cursorTo(ttyWriter, 0);
						const prefixWidth = 10; // "  Refine: " visible width
						const col = prefixWidth + buffer.getDisplayCursor();
						if (col > 0) {
							readline.moveCursor(ttyWriter, col, 0);
						}

						lastRefineLineRow = refineLineIndex;
					},
				});

				if (lastRefineLineRow > 0) {
					readline.moveCursor(ttyWriter, 0, -lastRefineLineRow);
				}
				readline.cursorTo(ttyWriter, 0);
				readline.clearScreenDown(ttyWriter);

				if (guide === null) {
					applyResult(
						transitionSelectorFlow(context, { type: "PROMPT_CANCEL" }),
					);
					return;
				}
				const trimmed = guide.trim();
				applyResult(
					transitionSelectorFlow(context, {
						type: "PROMPT_SUBMIT",
						guide: trimmed || undefined,
					}),
				);
			});
		};

		const openEditPrompt = async () => {
			const selected = getSelectedCandidate(
				context.slots,
				context.selectedIndex,
			);
			if (!selected) {
				return;
			}
			if (inlineEditPrompt) {
				await withPromptSuspended(async () => {
					let lastEditLineRow = 0;

					const edited = await editLine({
						input: ttyReader,
						output: ttyWriter,
						prefix: "",
						initialValue: selected.content,
						finalizeMode: "none",
						onRender: ({ buffer }) => {
							if (lastEditLineRow > 0) {
								readline.moveCursor(ttyWriter, 0, -lastEditLineRow);
							}
							readline.cursorTo(ttyWriter, 0);
							readline.clearScreenDown(ttyWriter);

							const frame = selectorRenderFrame({
								state: {
									...context,
									mode: "list",
									promptKind: context.promptKind,
									promptTargetIndex: context.promptTargetIndex,
								},
								nowMs: Date.now(),
								spinnerFrames: SPINNER_FRAMES,
								copy: selectorRenderCopy,
								capabilities: selectorRenderCapabilities,
							});

							const lines: string[] = [];
							const vm = frame.viewModel;
							const costSuffix = vm.header.totalCostLabel
								? ` (total: ${vm.header.totalCostLabel})`
								: "";
							lines.push(
								ui.success(`${vm.header.generatedLabel}${costSuffix}`),
							);
							lines.push("");

							let editLineIndex = 0;
							for (const slot of vm.slots) {
								if (slot.selected) {
									editLineIndex = lines.length;
									lines.push(
										`  ${theme.success}>${theme.reset} ${buffer.getText()}`,
									);
								} else {
									lines.push(
										`  ${theme.dim}○${theme.reset} ${theme.dim}${slot.title}${theme.reset}`,
									);
								}
								if (slot.meta) {
									const metaColor = slot.selected ? theme.primary : theme.dim;
									lines.push(`    ${metaColor}${slot.meta}${theme.reset}`);
								}
								lines.push("");
							}

							lines.push(`  ${ui.hint("enter apply | esc back to select")}`);
							ttyWriter.write(lines.join("\n"));

							const moveUp = lines.length - 1 - editLineIndex;
							if (moveUp > 0) {
								readline.moveCursor(ttyWriter, 0, -moveUp);
							}
							readline.cursorTo(ttyWriter, 0);
							const col = 4 + buffer.getDisplayCursor();
							if (col > 0) {
								readline.moveCursor(ttyWriter, col, 0);
							}

							lastEditLineRow = editLineIndex;
						},
					});

					if (lastEditLineRow > 0) {
						readline.moveCursor(ttyWriter, 0, -lastEditLineRow);
					}
					readline.cursorTo(ttyWriter, 0);
					readline.clearScreenDown(ttyWriter);

					if (edited === null) {
						applyResult(
							transitionSelectorFlow(context, {
								type: "PROMPT_CANCEL",
							}),
						);
						return;
					}
					applyResult(
						transitionSelectorFlow(context, {
							type: "PROMPT_SUBMIT",
							selectedContent: edited || selected.content,
						}),
					);
				});
				return;
			}
			await withPromptSuspended(async () => {
				let edited = selected.content;
				try {
					const result = await openEditor(selected.content);
					edited = result || selected.content;
				} catch {
					// Keep existing content when editor exits non-zero.
				}
				applyResult(
					transitionSelectorFlow(context, {
						type: "PROMPT_SUBMIT",
						selectedContent: edited,
					}),
				);
			});
		};

		const handleKeypress = async (
			_str: string | undefined,
			key: readline.Key,
		) => {
			if (!key || cleanedUp || isPromptOpen) return;

			if (
				key.name === "q" ||
				(key.name === "c" && key.ctrl) ||
				key.name === "escape"
			) {
				applyResult(transitionSelectorFlow(context, { type: "QUIT" }));
				return;
			}

			if (context.mode === "list") {
				if (key.name === "return") {
					applyResult(transitionSelectorFlow(context, { type: "CONFIRM" }));
					return;
				}
				if (key.name === "r" && key.sequence === "r") {
					if (!hasReadySlot(context.slots)) return;
					const transition = transitionSelectorFlow(context, {
						type: "OPEN_PROMPT",
						kind: "refine",
					});
					applyResult(transition);
					if (transition.context.mode === "prompt") {
						await openRefinePrompt();
					}
					return;
				}
				if (key.name === "e") {
					if (!hasReadySlot(context.slots)) return;
					const transition = transitionSelectorFlow(context, {
						type: "OPEN_PROMPT",
						kind: "edit",
					});
					applyResult(transition);
					if (transition.context.mode === "prompt") {
						await openEditPrompt();
					}
					return;
				}
				if (key.name === "up" || key.name === "k") {
					applyResult(
						transitionSelectorFlow(context, {
							type: "NAVIGATE",
							direction: -1,
						}),
					);
					return;
				}
				if (key.name === "down" || key.name === "j") {
					applyResult(
						transitionSelectorFlow(context, {
							type: "NAVIGATE",
							direction: 1,
						}),
					);
					return;
				}

				const number = Number.parseInt(key.name || "", 10);
				if (
					number >= 1 &&
					number <= context.slots.length &&
					context.slots[number - 1]?.status === "ready"
				) {
					applyResult(
						transitionSelectorFlow(context, {
							type: "CHOOSE_INDEX",
							index: number - 1,
						}),
					);
				}
				return;
			}
		};

		const abortSelection = () => {
			cleanup();
			resolveOnce({ action: "abort", abortReason: "exit" });
		};

		if (abortSignal?.aborted) {
			abortSelection();
		} else {
			abortSignal?.addEventListener("abort", abortSelection, {
				once: true,
			});
		}

		applyResult(
			transitionSelectorFlow(context, {
				type: "GENERATE_START",
			}),
		);

		ttyReader.on("keypress", handleKeypress);
	});
}
