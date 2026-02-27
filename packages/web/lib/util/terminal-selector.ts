import { raceAsyncIterators } from "../../../shared/async-race";
import type {
	PromptKind,
	SelectorFlowContext,
	SelectorResult,
	SelectorSlot,
	SelectorState,
	TerminalSelectorController,
	TerminalSelectorOptions,
} from "../../../shared/terminal-selector-contract";
import {
	applyCandidateToFlowContext,
	createInitialFlowContext,
	selectorStateFromFlowContext,
	transitionSelectorFlow,
} from "../../../shared/terminal-selector-flow";
import {
	formatSelectorHintActions,
	type SelectorCapabilities,
	type SelectorCopy,
	type SelectorRenderFrame,
	type SelectorSlotViewModel,
	selectorRenderFrame,
} from "../../../shared/terminal-selector-view-model";

export { selectorRenderFrame };

export type {
	CandidateWithModel,
	CreateCandidates,
	SelectorResult,
	SelectorState,
	TerminalSelectorController,
} from "../../../shared/terminal-selector-contract";

export const SPINNER_FRAMES = [
	"⠋",
	"⠙",
	"⠹",
	"⠸",
	"⠼",
	"⠴",
	"⠦",
	"⠧",
	"⠇",
	"⠏",
];

export interface RenderSelectorLinesOptions {
	runningLabel?: string;
	noReadyHint?: string;
	hasReadyHint?: string;
	copy?: Partial<SelectorCopy>;
	capabilities?: Partial<SelectorCapabilities>;
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

function formatSlot(slot: SelectorSlotViewModel): string[] {
	const lines = [`${slot.radio} ${slot.title}`];
	if (slot.meta) {
		lines.push(`   ${slot.meta}`);
	}
	return lines;
}

function renderPromptLines(frame: SelectorRenderFrame): string[] {
	const prompt = frame.prompt;
	if (!prompt) {
		return [];
	}

	const lines: string[] = [];
	if (prompt.selectedLine) {
		lines.push(prompt.selectedLine);
	}

	if (prompt.kind === "edit") {
		lines.push("");
		lines.push(`    ${prompt.modeLine}`);
		return lines;
	}

	lines.push("");
	lines.push(prompt.modeLine);
	lines.push(`${prompt.targetLineLabel} ${prompt.targetText}`);
	lines.push(prompt.costLine);
	lines.push("");
	lines.push(prompt.questionLine);
	return lines;
}

export function renderSelectorLinesFromRenderFrame(
	frame: SelectorRenderFrame,
	options: RenderSelectorLinesOptions = {},
): string[] {
	const lines: string[] = [];
	const viewModel = frame.viewModel;
	const costSuffix = viewModel.header.totalCostLabel
		? ` (total: ${viewModel.header.totalCostLabel})`
		: "";

	if (viewModel.header.mode === "running") {
		lines.push(
			`${viewModel.header.spinner} ${viewModel.header.runningLabel} ${viewModel.header.progress}${costSuffix}`,
		);
	} else {
		lines.push(`${viewModel.header.generatedLabel}${costSuffix}`);
	}

	if (frame.mode === "prompt") {
		lines.push(...renderPromptLines(frame));
		return lines;
	}

	lines.push("");

	for (const slot of viewModel.slots) {
		for (const line of formatSlot(slot)) {
			lines.push(line);
		}
		lines.push("");
	}

	if (viewModel.hint.kind === "ready") {
		const hintActions = formatSelectorHintActions(
			viewModel.hint.actions,
			"web",
		);
		lines.push(options.hasReadyHint ?? hintActions);
	} else {
		lines.push(
			options.noReadyHint ??
				formatSelectorHintActions(viewModel.hint.actions, "web"),
		);
	}

	return lines;
}

export function renderSelectorLines(
	state: SelectorState,
	nowMs: number,
	options: RenderSelectorLinesOptions = {},
): string[] {
	const copyOverrides: Partial<SelectorCopy> = {
		...options.copy,
	};
	if (options.runningLabel && copyOverrides.runningLabel == null) {
		copyOverrides.runningLabel = options.runningLabel;
	}
	const frame = selectorRenderFrame({
		state: {
			...state,
			createdAtMs: state.createdAtMs,
		},
		nowMs,
		spinnerFrames: SPINNER_FRAMES,
		copy: copyOverrides,
		capabilities: options.capabilities,
	});
	return renderSelectorLinesFromRenderFrame(frame, options);
}

function createInitialSlots(
	maxSlots: number,
	models?: string[],
): SelectorSlot[] {
	const safeMax = Math.max(1, maxSlots);
	return Array.from({ length: safeMax }, (_, index) => ({
		status: "pending",
		slotId: `slot-${index}`,
		model: models?.[index],
	}));
}

function createStateContext(
	options: TerminalSelectorOptions,
): SelectorFlowContext {
	const totalSlots = Math.max(1, options.maxSlots);
	return {
		...createInitialFlowContext({
			slots: createInitialSlots(totalSlots, options.models),
			totalSlots,
			listMode: "initial",
		}),
		isGenerating: false,
	};
}

function getPromptTargetText(context: SelectorFlowContext): string | undefined {
	const index = context.promptTargetIndex ?? context.selectedIndex;
	const selected = context.slots[index];
	return selected?.status === "ready" ? selected.candidate.content : undefined;
}

export function createTerminalSelectorController(
	options: TerminalSelectorOptions,
): TerminalSelectorController {
	const listeners = new Set<(state: SelectorState) => void>();
	let context: SelectorFlowContext = createStateContext(options);
	let generationRun = 0;
	let generationController: AbortController | null = null;

	const snapshotState = (): SelectorState =>
		selectorStateFromFlowContext(context);

	const emit = (nextState: SelectorState = snapshotState()): void => {
		for (const listener of listeners) {
			listener(nextState);
		}
		options.onState?.(nextState);
	};

	const cancelGeneration = () => {
		if (!generationController) {
			return;
		}
		generationController.abort();
		generationController = null;
	};

	const applyTransition = (
		transitionResult: ReturnType<typeof transitionSelectorFlow>,
	) => {
		context = transitionResult.context;
		let result: SelectorResult | null = null;
		if (transitionResult.result) {
			result = transitionResult.result;
		}

		for (const effect of transitionResult.effects) {
			if (effect.type === "cancelGeneration") {
				cancelGeneration();
			}
			if (effect.type === "startGeneration") {
				startGeneration();
			}
		}

		emit();
		return result;
	};

	const startGeneration = () => {
		cancelGeneration();
		generationController = new AbortController();
		const runId = ++generationRun;
		const iterator = options
			.createCandidates(generationController.signal, context.guideHint)
			[Symbol.asyncIterator]();
		const signal = generationController.signal;

		const run = async () => {
			try {
				for await (const { result } of raceAsyncIterators({
					iterators: [iterator],
					signal,
				})) {
					if (generationRun !== runId || signal.aborted) {
						return;
					}
					context = applyCandidateToFlowContext(context, result.value);
					emit();
				}
				if (generationRun !== runId || signal.aborted) {
					return;
				}
				applyTransition(
					transitionSelectorFlow(context, {
						type: "GENERATE_DONE",
					}),
				);
			} catch (error) {
				if (generationRun !== runId) {
					return;
				}
				if (signal.aborted || isAbortError(error)) {
					return;
				}
				applyTransition(
					transitionSelectorFlow(context, {
						type: "CANCEL_GENERATION",
					}),
				);
			} finally {
				try {
					await iterator.return?.();
				} catch {}
			}
		};

		run();
	};

	const start = () => {
		context = createStateContext(options);
		applyTransition(
			transitionSelectorFlow(context, {
				type: "GENERATE_START",
			}),
		);
	};

	const abort = (): SelectorResult => {
		cancelGeneration();
		context = {
			...createStateContext(options),
			isGenerating: false,
		};
		emit();
		return {
			action: "abort",
			abortReason: "exit",
		};
	};

	const confirm = (): SelectorResult | null => {
		cancelGeneration();
		return applyTransition(
			transitionSelectorFlow(context, {
				type: "CONFIRM",
			}),
		);
	};

	const moveSelection = (direction: -1 | 1) => {
		applyTransition(
			transitionSelectorFlow(context, {
				type: "NAVIGATE",
				direction,
			}),
		);
	};

	const setSelection = (index: number) => {
		applyTransition(
			transitionSelectorFlow(context, {
				type: "CHOOSE_INDEX",
				index,
			}),
		);
	};

	const runPrompt = (kind: PromptKind) => {
		const promptTargetIndex =
			context.promptTargetIndex ?? context.selectedIndex;
		const selectionText = getPromptTargetText(context);

		if (!options.onPrompt) {
			applyTransition(
				transitionSelectorFlow(context, {
					type: "PROMPT_CANCEL",
				}),
			);
			return;
		}

		void Promise.resolve(
			options.onPrompt({
				kind,
				promptTargetIndex,
				guideHint: context.guideHint,
				selectionText,
			}),
		)
			.then((input) => {
				if (input == null) {
					applyTransition(
						transitionSelectorFlow(context, {
							type: "PROMPT_CANCEL",
						}),
					);
					return;
				}

				if (kind === "refine") {
					applyTransition(
						transitionSelectorFlow(context, {
							type: "PROMPT_SUBMIT",
							guide: input,
						}),
					);
					return;
				}

				applyTransition(
					transitionSelectorFlow(context, {
						type: "PROMPT_SUBMIT",
						selectedContent: input,
					}),
				);
			})
			.catch(() => {
				applyTransition(
					transitionSelectorFlow(context, {
						type: "PROMPT_CANCEL",
					}),
				);
			});
	};

	const handleKey = (input: {
		key: string;
		ctrlKey?: boolean;
	}): SelectorResult | null => {
		const key = input.key;

		if (
			key === "q" ||
			key === "Escape" ||
			(key === "c" && input.ctrlKey === true)
		) {
			return applyTransition(
				transitionSelectorFlow(context, {
					type: "QUIT",
				}),
			);
		}

		if (key === "Enter") {
			return applyTransition(
				transitionSelectorFlow(context, {
					type: "CONFIRM",
				}),
			);
		}

		if (key === "ArrowUp" || key === "k") {
			return applyTransition(
				transitionSelectorFlow(context, {
					type: "NAVIGATE",
					direction: -1,
				}),
			);
		}

		if (key === "ArrowDown" || key === "j") {
			return applyTransition(
				transitionSelectorFlow(context, {
					type: "NAVIGATE",
					direction: 1,
				}),
			);
		}

		if (key === "r") {
			const transition = transitionSelectorFlow(context, {
				type: "OPEN_PROMPT",
				kind: "refine",
			});
			const result = applyTransition(transition);
			if (transition.context.mode === "prompt") {
				runPrompt("refine");
			}
			return result;
		}

		if (key === "e") {
			const transition = transitionSelectorFlow(context, {
				type: "OPEN_PROMPT",
				kind: "edit",
			});
			const result = applyTransition(transition);
			if (transition.context.mode === "prompt") {
				runPrompt("edit");
			}
			return result;
		}

		const number = Number.parseInt(key, 10);
		if (
			Number.isInteger(number) &&
			number >= 1 &&
			number <= context.slots.length
		) {
			return applyTransition(
				transitionSelectorFlow(context, {
					type: "CHOOSE_INDEX",
					index: number - 1,
				}),
			);
		}

		return null;
	};

	const destroy = () => {
		cancelGeneration();
		listeners.clear();
	};

	const createFrame = (options?: {
		nowMs?: number;
		copy?: Partial<SelectorCopy>;
		capabilities?: Partial<SelectorCapabilities>;
	}): SelectorRenderFrame => {
		const nowMs = options?.nowMs ?? Date.now();
		return selectorRenderFrame({
			state: {
				...context,
				mode: context.mode,
				promptKind: context.promptKind,
				promptTargetIndex: context.promptTargetIndex,
				createdAtMs: context.createdAtMs,
				slots: context.slots,
				selectedIndex: context.selectedIndex,
				isGenerating: context.isGenerating,
				totalSlots: context.totalSlots,
			},
			nowMs,
			spinnerFrames: SPINNER_FRAMES,
			copy: options?.copy,
			capabilities: options?.capabilities,
		});
	};

	return {
		get state() {
			return snapshotState();
		},
		snapshot: snapshotState,
		frame: createFrame,
		start,
		abort,
		confirm,
		moveSelection,
		setSelection,
		handleKey,
		destroy,
		subscribe: (listener) => {
			listeners.add(listener);
			listener(snapshotState());
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
