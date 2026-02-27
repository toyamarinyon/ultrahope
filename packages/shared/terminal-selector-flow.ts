import type {
	CandidateWithModel,
	ListMode,
	SelectorFlowContext,
	SelectorFlowEffect,
	SelectorFlowEvent,
	SelectorFlowResult,
	SelectorFlowTransition,
	SelectorSlot,
} from "./terminal-selector-contract";
import {
	getLatestQuota,
	getSelectedCandidate,
	getTotalCost,
	hasReadySlot,
	normalizeCandidateContentForDisplay,
	selectNearestReady,
} from "./terminal-selector-helpers";

interface CreateFlowContextOptions {
	slots: SelectorSlot[];
	totalSlots?: number;
	createdAtMs?: number;
	listMode?: ListMode;
	selectedIndex?: number;
	guideHint?: string;
	editedSelections?: Map<string, string>;
}

function cloneSlots(slots: SelectorSlot[]): SelectorSlot[] {
	return slots.map((slot) => {
		if (slot.status === "ready") {
			return { ...slot, candidate: { ...slot.candidate } };
		}
		return { ...slot };
	});
}

function cloneContext(context: SelectorFlowContext): SelectorFlowContext {
	return {
		...context,
		slots: cloneSlots(context.slots),
		editedSelections: new Map(context.editedSelections),
	};
}

function normalizeSelectedIndex(
	slots: SelectorSlot[],
	selectedIndex: number,
): number {
	if (slots.length === 0) {
		return 0;
	}
	if (selectedIndex < 0) {
		return -1;
	}
	if (selectedIndex >= slots.length) {
		return slots.length - 1;
	}
	return selectedIndex;
}

function getFirstReadyIndex(slots: SelectorSlot[]): number {
	for (let index = 0; index < slots.length; index += 1) {
		if (slots[index]?.status === "ready") {
			return index;
		}
	}
	return -1;
}

function normalizeGuide(rawGuide?: string): string | undefined {
	if (!rawGuide) return undefined;
	const trimmed = rawGuide.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function toPendingSlots(
	slots: SelectorSlot[],
	totalSlots: number,
): SelectorSlot[] {
	const safeTotal = Math.max(1, totalSlots);
	const nextSlots: SelectorSlot[] = [];
	for (let index = 0; index < safeTotal; index += 1) {
		const source = slots[index];
		const sourceSlotId =
			source?.status === "ready"
				? source.candidate.slotId
				: source?.status === "pending" || source?.status === "error"
					? source.slotId
					: undefined;
		const sourceModel =
			source?.status === "ready"
				? source.candidate.model
				: source?.status === "pending" || source?.status === "error"
					? source.model
					: undefined;
		nextSlots.push({
			status: "pending",
			slotId: sourceSlotId || sourceModel || `slot-${index}`,
			model: sourceModel,
		});
	}
	return nextSlots;
}

function collapseToReady(slots: SelectorSlot[]): SelectorSlot[] {
	return slots.filter((slot) => slot.status === "ready");
}

function resolveCandidateSlotIndex(
	slots: SelectorSlot[],
	candidate: CandidateWithModel,
): number {
	const bySlotId = slots.findIndex((slot) => {
		const slotId =
			slot.status === "ready" ? slot.candidate.slotId : slot.slotId;
		return slotId === candidate.slotId;
	});
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

export function createInitialFlowContext(
	options: CreateFlowContextOptions,
): SelectorFlowContext {
	const safeTotalSlots = Math.max(
		1,
		options.totalSlots ?? options.slots.length,
	);
	return {
		mode: "list",
		listMode: options.listMode ?? "initial",
		slots: cloneSlots(toPendingSlots(options.slots, safeTotalSlots)),
		selectedIndex: options.selectedIndex ?? 0,
		isGenerating: true,
		totalSlots: safeTotalSlots,
		createdAtMs: options.createdAtMs ?? Date.now(),
		editedSelections: new Map(options.editedSelections),
		guideHint: normalizeGuide(options.guideHint),
	};
}

export function selectorStateFromFlowContext(context: SelectorFlowContext): {
	slots: SelectorSlot[];
	selectedIndex: number;
	isGenerating: boolean;
	totalSlots: number;
	createdAtMs: number;
} {
	return {
		slots: cloneSlots(context.slots),
		selectedIndex: context.selectedIndex,
		isGenerating: context.isGenerating,
		totalSlots: context.totalSlots,
		createdAtMs: context.createdAtMs,
	};
}

export function applyCandidateToFlowContext(
	context: SelectorFlowContext,
	candidate: CandidateWithModel,
): SelectorFlowContext {
	const next = cloneContext(context);
	const targetIndex = resolveCandidateSlotIndex(next.slots, candidate);
	if (targetIndex < 0) {
		return next;
	}
	const normalizedCandidate = {
		...candidate,
		content: normalizeCandidateContentForDisplay(candidate.content),
	};
	const normalizedHasContent = normalizedCandidate.content.trim().length > 0;

	const current = next.slots[targetIndex];
	const currentSlotId =
		current.status === "ready" ? current.candidate.slotId : current.slotId;
	if (!currentSlotId) {
		return next;
	}

	const hasCandidateContent = normalizedHasContent;
	const isPending = current.status === "pending";
	if (hasCandidateContent) {
		next.slots[targetIndex] = {
			status: "ready",
			candidate: {
				...normalizedCandidate,
				slotId: currentSlotId,
			},
		};
	} else if (current.status === "ready") {
		if (candidate.slotId !== currentSlotId) {
			return next;
		}
		next.slots[targetIndex] = {
			status: "ready",
			candidate: {
				...current.candidate,
				...normalizedCandidate,
				slotId: currentSlotId,
			},
		};
	}

	if (
		isPending &&
		(next.selectedIndex >= next.slots.length ||
			next.slots[next.selectedIndex]?.status !== "ready")
	) {
		next.selectedIndex = targetIndex;
	}

	return next;
}

function createFlowResult(
	context: SelectorFlowContext,
	selectedContent?: string,
): SelectorFlowResult {
	const selectedCandidate = getSelectedCandidate(
		context.slots,
		context.selectedIndex,
	);
	if (!selectedCandidate) {
		return {
			action: "abort",
			abortReason: "exit",
			error: new Error("No candidate selected"),
		};
	}

	const candidateId = selectedCandidate.slotId;
	const finalContent =
		selectedContent ??
		(context.editedSelections.get(candidateId) || selectedCandidate.content) ??
		selectedCandidate.content;
	const totalCost = getTotalCost(context.slots);
	const quota = getLatestQuota(context.slots);
	const edited = Boolean(
		selectedCandidate && finalContent !== selectedCandidate.content,
	);

	return {
		action: "confirm",
		selected: finalContent,
		edited,
		selectedIndex: context.selectedIndex,
		selectedCandidate,
		totalCost: totalCost > 0 ? totalCost : undefined,
		quota,
	};
}

function clearPrompt(context: SelectorFlowContext): void {
	delete context.promptKind;
	delete context.promptTargetIndex;
}

export function transitionSelectorFlow(
	context: SelectorFlowContext,
	event: SelectorFlowEvent,
): SelectorFlowTransition {
	const next = cloneContext(context);
	let result: SelectorFlowResult | undefined;
	const effects: SelectorFlowEffect[] = [];
	const safeSelectedIndex = normalizeSelectedIndex(
		next.slots,
		next.selectedIndex,
	);
	next.selectedIndex = safeSelectedIndex;

	switch (event.type) {
		case "GENERATE_START": {
			next.isGenerating = true;
			next.slots = toPendingSlots(next.slots, next.totalSlots);
			next.selectedIndex = 0;
			next.editedSelections = new Map();
			next.guideHint = normalizeGuide(next.guideHint);
			next.createdAtMs = Date.now();
			clearPrompt(next);
			effects.push({ type: "startGeneration" });
			break;
		}
		case "GENERATE_DONE": {
			next.slots = collapseToReady(next.slots);
			next.isGenerating = false;
			next.selectedIndex = getFirstReadyIndex(next.slots);
			break;
		}
		case "CANCEL_GENERATION": {
			next.isGenerating = false;
			effects.push({ type: "cancelGeneration" });
			break;
		}
		case "NAVIGATE":
			if (next.mode === "list") {
				next.selectedIndex = selectNearestReady(
					next.slots,
					next.selectedIndex,
					event.direction,
				);
			}
			break;
		case "CHOOSE_INDEX":
			if (
				next.mode === "list" &&
				next.slots[event.index]?.status === "ready" &&
				event.index >= 0 &&
				event.index < next.slots.length
			) {
				next.selectedIndex = event.index;
			}
			break;
		case "OPEN_PROMPT":
			if (
				next.mode === "list" &&
				next.selectedIndex >= 0 &&
				next.selectedIndex < next.slots.length &&
				hasReadySlot(next.slots)
			) {
				next.mode = "prompt";
				next.promptKind = event.kind;
				next.promptTargetIndex = next.selectedIndex;
				effects.push({ type: "cancelGeneration" });
				next.isGenerating = false;
			}
			break;
		case "PROMPT_CANCEL": {
			clearPrompt(next);
			next.mode = "list";
			next.isGenerating = false;
			break;
		}
		case "PROMPT_SUBMIT": {
			if (next.mode !== "prompt") break;
			const targetPromptKind = next.promptKind ?? "edit";
			const targetIndex = next.promptTargetIndex ?? next.selectedIndex;
			next.mode = "list";
			next.selectedIndex = normalizeSelectedIndex(next.slots, targetIndex);
			clearPrompt(next);

			if (targetPromptKind === "refine") {
				next.guideHint = normalizeGuide(event.guide);
				next.listMode = "refined";
				next.editedSelections = new Map();
				next.slots = toPendingSlots(next.slots, next.totalSlots);
				next.selectedIndex = 0;
				next.isGenerating = true;
				effects.push({ type: "startGeneration" });
				break;
			}

			const selectedCandidate = getSelectedCandidate(
				next.slots,
				next.selectedIndex,
			);
			if (!selectedCandidate) {
				break;
			}

			if (event.selectedContent != null) {
				next.editedSelections.set(
					selectedCandidate.slotId,
					event.selectedContent,
				);
			}
			result = createFlowResult(next, event.selectedContent);
			break;
		}
		case "CONFIRM": {
			if (next.mode === "list" && hasReadySlot(next.slots)) {
				result = createFlowResult(next);
			}
			break;
		}
		case "QUIT": {
			if (next.mode === "prompt") {
				next.mode = "list";
				clearPrompt(next);
				break;
			}
			if (next.listMode === "initial") {
				result = { action: "abort", abortReason: "exit" };
				break;
			}
			next.guideHint = undefined;
			next.listMode = "initial";
			next.editedSelections = new Map();
			next.slots = toPendingSlots(next.slots, next.totalSlots);
			next.selectedIndex = 0;
			next.isGenerating = true;
			effects.push({ type: "startGeneration" });
			break;
		}
	}

	next.selectedIndex = normalizeSelectedIndex(next.slots, next.selectedIndex);
	if (next.selectedIndex < 0 && hasReadySlot(next.slots)) {
		next.selectedIndex = getFirstReadyIndex(next.slots);
	}
	return {
		context: next,
		effects,
		...(result ? { result } : {}),
	};
}
