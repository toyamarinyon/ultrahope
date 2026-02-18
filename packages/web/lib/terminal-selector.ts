import type {
	CandidateWithModel,
	CreateCandidates,
	QuotaInfo,
	SelectorResult,
	SelectorSlot,
	SelectorState,
	TerminalSelectorController,
	TerminalSelectorOptions,
} from "../../shared/terminal-selector-contract";

export type {
	CandidateWithModel,
	CommitMessageGenerationPort,
	CreateCandidates,
	GenerateCommitMessageGenerationInput,
	GenerationScheduler,
	GenerationSchedulerAction,
	QuotaInfo,
	SelectorResult,
	SelectorSlot,
	SelectorState,
	TerminalSelectorController,
	TerminalSelectorOptions,
} from "../../shared/terminal-selector-contract";

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
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

export function formatModelName(model: string): string {
	const parts = model.split("/");
	return parts.length > 1 ? parts[1] : model;
}

function formatCost(cost: number): string {
	return `$${cost.toFixed(7).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function formatTotalCostLabel(cost: number): string {
	return `$${cost.toFixed(6)}`;
}

export function getReadyCount(slots: SelectorSlot[]): number {
	return slots.filter((slot) => slot.status === "ready").length;
}

export function getTotalCost(slots: SelectorSlot[]): number {
	return slots.reduce((sum, slot) => {
		if (slot.status === "ready" && slot.candidate.cost != null) {
			return sum + slot.candidate.cost;
		}
		return sum;
	}, 0);
}

export function getLatestQuota(slots: SelectorSlot[]): QuotaInfo | undefined {
	for (const slot of slots) {
		if (slot.status === "ready" && slot.candidate.quota) {
			return slot.candidate.quota;
		}
	}
	return undefined;
}

export function hasReadySlot(slots: SelectorSlot[]): boolean {
	return getReadyCount(slots) > 0;
}

export function selectNearestReady(
	slots: SelectorSlot[],
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

export function formatSlot(slot: SelectorSlot, selected: boolean): string[] {
	if (slot.status === "pending") {
		const line = `${selected ? "●" : "○"} Generating...`;
		const meta = slot.model ? `   ${formatModelName(slot.model)}` : "";
		return meta ? [line, meta] : [line];
	}

	if (slot.status === "error") {
		const line = `${selected ? "●" : "○"} ${slot.content}`;
		return [line];
	}

	const title = slot.candidate.content.split("\n")[0]?.trim() || "";
	const radio = selected ? "●" : "○";
	const modelInfo = slot.candidate.model
		? slot.candidate.cost != null
			? `${formatModelName(slot.candidate.model)} ${formatCost(slot.candidate.cost)}`
			: formatModelName(slot.candidate.model)
		: "";
	const lines = [`${radio} ${title}`];
	if (modelInfo) {
		lines.push(`   ${modelInfo}`);
	}
	return lines;
}

export function renderSelectorLines(
	state: SelectorState,
	nowMs: number,
	options: RenderSelectorLinesOptions = {},
): string[] {
	const lines: string[] = [];
	const readyCount = getReadyCount(state.slots);
	const totalCost = getTotalCost(state.slots);
	const costSuffix =
		totalCost > 0 ? ` (total: ${formatTotalCostLabel(totalCost)})` : "";
	const runningLabel = options.runningLabel ?? "Generating commit messages...";

	if (state.isGenerating) {
		const frame = Math.floor(nowMs / 80) % SPINNER_FRAMES.length;
		const progress = `${readyCount}/${state.totalSlots}`;
		lines.push(
			`${SPINNER_FRAMES[frame]} ${runningLabel} ${progress}${costSuffix}`,
		);
	} else {
		const label =
			readyCount === 1
				? `1 commit message generated${costSuffix}`
				: `${readyCount} commit messages generated${costSuffix}`;
		lines.push(label);
	}

	if (readyCount > 0) {
		lines.push(
			options.hasReadyHint ??
				"Select a candidate (↑↓ navigate, enter confirm, r reroll)",
		);
	} else {
		lines.push(options.noReadyHint ?? "q quit");
	}

	lines.push("");
	for (let index = 0; index < state.slots.length; index++) {
		for (const line of formatSlot(
			state.slots[index],
			index === state.selectedIndex,
		)) {
			lines.push(line);
		}
		lines.push("");
	}

	return lines;
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

function getSelectedCandidate(
	slots: SelectorSlot[],
	selectedIndex: number,
): CandidateWithModel | undefined {
	const slot = slots[selectedIndex];
	return slot?.status === "ready" ? slot.candidate : undefined;
}

function normalizeState(state: SelectorState) {
	if (state.slots.length === 0) {
		state.selectedIndex = 0;
		return;
	}
	if (state.selectedIndex < 0) {
		state.selectedIndex = 0;
		return;
	}
	if (state.selectedIndex >= state.slots.length) {
		state.selectedIndex = state.slots.length - 1;
	}
}

function collapseToReady(slots: SelectorSlot[]): SelectorSlot[] {
	return slots.filter((slot) => slot.status !== "pending");
}

function resolveSlotByCandidate(
	slots: SelectorSlot[],
	candidate: CandidateWithModel,
): number {
	const bySlotId = slots.findIndex((slot) => slot.slotId === candidate.slotId);
	if (bySlotId >= 0) {
		return bySlotId;
	}

	if (candidate.slotIndex != null) {
		const bySlotIndex = slots[candidate.slotIndex];
		if (bySlotIndex) {
			return candidate.slotIndex;
		}
	}

	if (candidate.model != null) {
		const byModel = slots.findIndex(
			(slot) => slot.status === "pending" && slot.model === candidate.model,
		);
		if (byModel >= 0) {
			return byModel;
		}
	}

	const byPending = slots.findIndex((slot) => slot.status === "pending");
	return byPending >= 0 ? byPending : -1;
}

function hasContent(text: string): boolean {
	return text.trim().length > 0;
}

export function createTerminalSelectorController(
	options: TerminalSelectorOptions,
): TerminalSelectorController {
	const listeners = new Set<(state: SelectorState) => void>();
	let state: SelectorState = {
		slots: createInitialSlots(options.maxSlots, options.models),
		selectedIndex: 0,
		isGenerating: false,
		totalSlots: Math.max(1, options.maxSlots),
		createdAtMs: Date.now(),
	};
	let generationRun = 0;
	let generationController: AbortController | null = null;

	const emit = (nextState: SelectorState = state): void => {
		for (const listener of listeners) {
			listener(nextState);
		}
		options.onState?.(nextState);
	};

	const getState = (): SelectorState => ({ ...state, slots: [...state.slots] });

	const setState = (
		updater: (draft: { slots: SelectorSlot[] } & SelectorState) => void,
	) => {
		const next: { slots: SelectorSlot[] } & SelectorState = {
			...state,
			slots: [...state.slots],
		};
		updater(next);
		normalizeState(next);
		state = {
			...next,
			slots: [...next.slots],
		};
		emit(state);
	};

	const abortGeneration = () => {
		if (generationController) {
			generationController.abort();
			generationController = null;
		}
	};

	const finalizeState = (runId: number) => {
		if (generationRun !== runId) return;
		setState((draft) => {
			draft.slots = collapseToReady(draft.slots);
			draft.isGenerating = false;
		});
	};

	const applyCandidate = (candidate: CandidateWithModel, runId: number) => {
		if (generationRun !== runId) return;
		setState((draft) => {
			const targetIndex = resolveSlotByCandidate(draft.slots, candidate);
			if (targetIndex < 0) {
				return;
			}

			const current = draft.slots[targetIndex];
			const isPending = current.status === "pending";
			if (hasContent(candidate.content)) {
				draft.slots[targetIndex] = {
					status: "ready",
					candidate: {
						...candidate,
						slotId: current.slotId,
					},
				};
			} else if (current.status === "ready") {
				if (candidate.slotId !== current.candidate.slotId) {
					return;
				}
				draft.slots[targetIndex] = {
					status: "ready",
					candidate: {
						...current.candidate,
						...candidate,
						slotId: current.slotId,
					},
				};
			}

			if (
				isPending &&
				(draft.selectedIndex >= draft.slots.length ||
					draft.slots[draft.selectedIndex]?.status !== "ready")
			) {
				draft.selectedIndex = targetIndex;
			}
		});
	};

	const consumeCandidates = async (runId: number) => {
		if (generationRun !== runId) return;
		const candidatesIterable = options.createCandidates(
			generationController?.signal ?? new AbortController().signal,
		);
		const iterator = candidatesIterable[Symbol.asyncIterator]();
		let iteratorDone = false;
		const signal = generationController?.signal;
		const abortPromise = new Promise<{
			kind: "aborted";
		}>((resolve) => {
			if (!signal) {
				resolve({ kind: "aborted" });
				return;
			}
			signal.addEventListener("abort", () => resolve({ kind: "aborted" }), {
				once: true,
			});
		});

		try {
			while (!iteratorDone && generationRun === runId) {
				const winner = await Promise.race([
					iterator
						.next()
						.then((result) => ({ kind: "candidate", result }) as const),
					abortPromise.then((value) => value),
				]);

				if (winner.kind === "aborted") {
					break;
				}
				if (signal?.aborted) {
					break;
				}

				const result = winner.result;
				if (result.done) {
					iteratorDone = true;
					break;
				}
				applyCandidate(result.value, runId);
			}
		} finally {
			await iterator.return?.();
			if (generationRun === runId && (!signal || !signal.aborted)) {
				finalizeState(runId);
			}
		}
	};

	const start = () => {
		generationRun += 1;
		const runId = generationRun;

		abortGeneration();
		generationController = new AbortController();
		state = {
			slots: createInitialSlots(options.maxSlots, options.models),
			selectedIndex: 0,
			isGenerating: true,
			totalSlots: Math.max(1, options.maxSlots),
			createdAtMs: Date.now(),
		};
		emit();
		consumeCandidates(runId).catch((error) => {
			if (runId !== generationRun) return;
			if (isAbortError(error)) {
				return;
			}
			setState((draft) => {
				draft.isGenerating = false;
			});
		});
	};

	const abort = () => {
		abortGeneration();
		state = {
			slots: createInitialSlots(options.maxSlots, options.models),
			selectedIndex: 0,
			isGenerating: false,
			totalSlots: Math.max(1, options.maxSlots),
			createdAtMs: Date.now(),
		};
		emit();
		return {
			action: "abort",
			error: undefined,
		};
	};

	const reroll = () => {
		if (!hasReadySlot(state.slots)) {
			return null;
		}
		abort();
		return { action: "reroll" };
	};

	const confirm = () => {
		const selectedCandidate = getSelectedCandidate(
			state.slots,
			state.selectedIndex,
		);
		if (!selectedCandidate) {
			return null;
		}
		abortGeneration();
		state = {
			...state,
			isGenerating: false,
		};
		emit();
		return {
			action: "confirm",
			selected: selectedCandidate.content,
			selectedIndex: state.selectedIndex,
			selectedCandidate,
			totalCost: getTotalCost(state.slots) || undefined,
			quota: getLatestQuota(state.slots),
		};
	};

	const moveSelection = (direction: -1 | 1) => {
		setState((draft) => {
			draft.selectedIndex = selectNearestReady(
				draft.slots,
				draft.selectedIndex,
				direction,
			);
		});
	};

	const setSelection = (index: number) => {
		setState((draft) => {
			if (index < 0 || index >= draft.slots.length) {
				return;
			}
			if (draft.slots[index]?.status !== "ready") {
				return;
			}
			draft.selectedIndex = index;
		});
	};

	const handleKey = (input: { key: string; ctrlKey?: boolean }) => {
		const key = input.key;

		if (
			key === "q" ||
			key === "Escape" ||
			(key === "c" && input.ctrlKey === true)
		) {
			return abort();
		}

		if (key === "r") {
			return reroll();
		}

		if (key === "Enter") {
			return confirm();
		}

		if (key === "ArrowUp" || key === "k") {
			moveSelection(-1);
			return null;
		}

		if (key === "ArrowDown" || key === "j") {
			moveSelection(1);
			return null;
		}

		const number = Number.parseInt(key, 10);
		if (
			Number.isInteger(number) &&
			number >= 1 &&
			number <= state.slots.length
		) {
			setSelection(number - 1);
			return null;
		}

		return null;
	};

	const destroy = () => {
		abortGeneration();
		listeners.clear();
	};

	return {
		get state() {
			return getState();
		},
		start,
		abort,
		reroll,
		confirm,
		moveSelection,
		setSelection,
		handleKey,
		destroy,
		subscribe: (listener) => {
			listeners.add(listener);
			listener(state);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
