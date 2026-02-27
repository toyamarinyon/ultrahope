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
import {
	createRenderer,
	renderSelectorTextFromRenderFrame,
	SPINNER_FRAMES,
} from "./renderer";
import { theme } from "./theme";
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
}

const TTY_PATH = "/dev/tty";

const selectorRenderCopy = {
	runningLabel: "Generating commit messages...",
};

const selectorRenderCapabilities = {
	edit: true,
	refine: true,
	clickConfirm: false,
};

type InlinePromptOptions = {
	initialValue?: string;
	cancelOnQ?: boolean;
	cancelOnEscape?: boolean;
	trimResult?: boolean;
	showPrompt?: boolean;
	promptPrefix?: string;
	helpText?: string;
	helpSpacing?: number;
};

function renderError(
	error: unknown,
	slotsLength: number,
	output: tty.WriteStream,
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
		const renderer = createRenderer(ttyWriter);

		readline.emitKeypressEvents(ttyReader);
		ttyReader.setRawMode(true);

		const setRawModeSafe = (enabled: boolean) => {
			try {
				ttyReader.setRawMode(enabled);
			} catch {
				// Ignore tty mode errors during shutdown.
			}
		};

		const render = () => {
			if (!cleanedUp && !isPromptOpen) {
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
			if (clearOutput) {
				renderer.clearAll();
			}
			ttyReader.removeAllListeners("keypress");
			setRawModeSafe(false);
			ttyReader.pause();
			if (ttyReader !== process.stdin && !ttyReader.destroyed) {
				ttyReader.destroy();
			}
			if (
				ttyWriter !== process.stdout &&
				ttyWriter !== process.stderr &&
				!ttyWriter.destroyed
			) {
				ttyWriter.destroy();
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
			renderer.clearAll();
			render();
		};

		const withPromptSuspended = async (task: () => Promise<void>) => {
			if (isPromptOpen || cleanedUp) return;
			isPromptOpen = true;
			stopRenderLoop();
			setRawModeSafe(false);
			ttyReader.removeListener("keypress", handleKeypress);
			await task();
			if (cleanedUp) return;
			isPromptOpen = false;
			ttyReader.on("keypress", handleKeypress);
			setRawModeSafe(true);
			renderForPrompt();
		};

		const openInlinePrompt = async (
			prompt: string,
			options: InlinePromptOptions = {},
		): Promise<string | null> =>
			new Promise<string | null>((resolve) => {
				const {
					initialValue = "",
					cancelOnQ = false,
					cancelOnEscape = false,
					trimResult = true,
					showPrompt = true,
					promptPrefix = "",
					helpText,
					helpSpacing = 0,
				} = options;
				const promptReader = readline.createInterface({
					input: ttyReader,
					output: ttyWriter,
					terminal: true,
				});
				let done = false;
				const finish = (value: string | null) => {
					if (done) return;
					done = true;
					promptReader.close();
					resolve(value);
				};
				promptReader.on("SIGINT", () => finish(null));
				let restoreKeypress = false;
				const handlePromptKeypress = (
					_str: string,
					key: readline.Key | undefined,
				) => {
					if (!cancelOnEscape) return;
					if (key?.name === "escape") {
						finish(null);
						return;
					}
				};
				if (cancelOnEscape) {
					readline.emitKeypressEvents(ttyReader);
					ttyReader.on("keypress", handlePromptKeypress);
					restoreKeypress = true;
				}
				const appliedPrompt = showPrompt
					? ui.prompt(prompt)
					: promptPrefix || "";
				promptReader.setPrompt(appliedPrompt);
				promptReader.prompt();
				if (initialValue) {
					promptReader.write(initialValue);
				}
				if (helpText) {
					const restoreColumn = appliedPrompt.length + initialValue.length;
					readline.moveCursor(ttyWriter, 0, helpSpacing);
					readline.cursorTo(ttyWriter, 0);
					readline.clearLine(ttyWriter, 0);
					ttyWriter.write(helpText);
					readline.moveCursor(ttyWriter, 0, -helpSpacing);
					readline.cursorTo(ttyWriter, restoreColumn);
				}

				promptReader.on("line", (input) => {
					let value = input ?? "";
					if (trimResult) {
						value = value.trim();
					}
					if (cancelOnQ && value.toLowerCase() === "q") {
						finish(null);
						return;
					}
					finish(value);
				});
				promptReader.on("close", () => {
					if (restoreKeypress) {
						ttyReader.off("keypress", handlePromptKeypress);
					}
				});
			});

		const openRefinePrompt = async () => {
			await withPromptSuspended(async () => {
				const guide = await openInlinePrompt(
					"Enter refine instructions (e.g., more formal / shorter / Enter to clear, q=cancel): ",
					{ cancelOnQ: true },
				);
				if (guide === null) {
					applyResult(
						transitionSelectorFlow(context, { type: "PROMPT_CANCEL" }),
					);
					return;
				}
				applyResult(
					transitionSelectorFlow(context, {
						type: "PROMPT_SUBMIT",
						guide,
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
					const edited = await openInlinePrompt("", {
						initialValue: selected.content,
						cancelOnEscape: true,
						showPrompt: false,
						promptPrefix: "    > ",
						helpText: `    ${ui.hint(
							"enter: apply | esc: back to select a candidate",
						)}`,
						helpSpacing: 2,
						trimResult: false,
					});
					if (edited === null) {
						applyResult(
							transitionSelectorFlow(context, { type: "PROMPT_CANCEL" }),
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
