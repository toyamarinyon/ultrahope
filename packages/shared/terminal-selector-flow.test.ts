import { describe, expect, it } from "bun:test";
import type {
	SelectorFlowContext,
	SelectorSlot,
} from "./terminal-selector-contract";
import {
	applyCandidateToFlowContext,
	createInitialFlowContext,
	transitionSelectorFlow,
} from "./terminal-selector-flow";

function readySlot(overrides: Partial<SelectorSlot> = {}): SelectorSlot {
	return {
		status: "ready",
		candidate: {
			content: "feat: default candidate",
			slotId: "slot-0",
			model: "openai/gpt-4.1",
		},
		...overrides,
	} as SelectorSlot;
}

function contextWithReadySlots(
	overrides: Partial<SelectorFlowContext> = {},
): SelectorFlowContext {
	const base: SelectorFlowContext = {
		mode: "list",
		listMode: "initial",
		slots: [readySlot({ candidate: { content: "first", slotId: "slot-0" } })],
		selectedIndex: 0,
		isGenerating: false,
		totalSlots: 1,
		createdAtMs: 0,
		editedSelections: new Map(),
		...overrides,
	};
	return base;
}

describe("terminal-selector-flow", () => {
	it("starts generation with reset slots and startGeneration effect", () => {
		const context = createInitialFlowContext({
			slots: [
				{ status: "pending", slotId: "slot-0" },
				{ status: "pending", slotId: "slot-1" },
			],
			totalSlots: 2,
			listMode: "initial",
		});
		const transition = transitionSelectorFlow(context, {
			type: "GENERATE_START",
		});

		expect(transition.context.isGenerating).toBe(true);
		expect(transition.context.slots).toHaveLength(2);
		expect(transition.context.slots[0]?.status).toBe("pending");
		expect(transition.effects).toEqual([{ type: "startGeneration" }]);
	});

	it("transitions to Prompt and returns to List with q while preserving listMode", () => {
		const context = contextWithReadySlots({
			totalSlots: 2,
			slots: [
				readySlot({ candidate: { content: "first", slotId: "slot-0" } }),
				readySlot({ candidate: { content: "second", slotId: "slot-1" } }),
			],
		});
		const open = transitionSelectorFlow(context, {
			type: "OPEN_PROMPT",
			kind: "edit",
		});

		expect(open.context.mode).toBe("prompt");
		expect(open.context.promptKind).toBe("edit");

		const cancel = transitionSelectorFlow(open.context, { type: "QUIT" });
		expect(cancel.context.mode).toBe("list");
		expect(cancel.context.listMode).toBe("initial");
		expect(cancel.effects).toHaveLength(0);
	});

	it("supports LIST quit flow: abort on initial mode and restart on refined mode", () => {
		const initial = contextWithReadySlots({
			listMode: "initial",
			isGenerating: false,
			totalSlots: 1,
			slots: [readySlot({ candidate: { content: "first", slotId: "slot-0" } })],
		});
		const quitInitial = transitionSelectorFlow(initial, { type: "QUIT" });
		expect(quitInitial.result?.action).toBe("abort");
		expect(quitInitial.result?.abortReason).toBe("exit");

		const refined = contextWithReadySlots({
			listMode: "refined",
			isGenerating: false,
			totalSlots: 1,
			slots: [readySlot({ candidate: { content: "first", slotId: "slot-0" } })],
		});
		const quitRefined = transitionSelectorFlow(refined, { type: "QUIT" });

		expect(quitRefined.context.listMode).toBe("initial");
		expect(quitRefined.context.isGenerating).toBe(true);
		expect(quitRefined.effects).toEqual([{ type: "startGeneration" }]);
	});

	it("submits refine prompt and enters refined regenerate list mode", () => {
		const context = contextWithReadySlots({
			totalSlots: 2,
			slots: [
				readySlot({ candidate: { content: "first", slotId: "slot-0" } }),
				readySlot({ candidate: { content: "second", slotId: "slot-1" } }),
			],
		});
		const open = transitionSelectorFlow(context, {
			type: "OPEN_PROMPT",
			kind: "refine",
		});
		const refined = transitionSelectorFlow(open.context, {
			type: "PROMPT_SUBMIT",
			guide: "more concise",
		});

		expect(refined.context.mode).toBe("list");
		expect(refined.context.listMode).toBe("refined");
		expect(refined.context.guideHint).toBe("more concise");
		expect(refined.context.isGenerating).toBe(true);
		expect(refined.effects).toEqual([{ type: "startGeneration" }]);
		expect(
			refined.context.slots.every((slot) => slot.status === "pending"),
		).toBe(true);
	});

	it("submits edited content with immediate confirmation", () => {
		const context = contextWithReadySlots({
			totalSlots: 2,
			slots: [
				readySlot({ candidate: { content: "first", slotId: "slot-0" } }),
				readySlot({ candidate: { content: "second", slotId: "slot-1" } }),
			],
		});
		const open = transitionSelectorFlow(context, {
			type: "OPEN_PROMPT",
			kind: "edit",
		});
		const edited = transitionSelectorFlow(open.context, {
			type: "PROMPT_SUBMIT",
			selectedContent: "first [edited]",
		});

		expect(edited.result?.action).toBe("confirm");
		expect(edited.result?.selected).toBe("first [edited]");
		expect(edited.result?.selectedCandidate?.slotId).toBe("slot-0");
	});

	it("applies generated candidates by slot id and finalizes as list", () => {
		const pendingContext = createInitialFlowContext({
			slots: [
				{ status: "pending", slotId: "slot-0" },
				{ status: "pending", slotId: "slot-1" },
			],
			totalSlots: 2,
			listMode: "initial",
		});
		const generated = applyCandidateToFlowContext(pendingContext, {
			content: "first",
			slotId: "slot-0",
			model: "openai/gpt-4.1",
		});
		const done = transitionSelectorFlow(generated, { type: "GENERATE_DONE" });

		expect(done.context.isGenerating).toBe(false);
		expect(done.context.slots).toHaveLength(1);
		expect(done.context.slots[0]?.status).toBe("ready");
	});

	it("navigates and jumps selection by index", () => {
		const context = contextWithReadySlots({
			totalSlots: 3,
			slots: [
				readySlot({ candidate: { content: "first", slotId: "slot-0" } }),
				readySlot({ candidate: { content: "second", slotId: "slot-1" } }),
				readySlot({ candidate: { content: "third", slotId: "slot-2" } }),
			],
		});
		const chosen = transitionSelectorFlow(context, {
			type: "CHOOSE_INDEX",
			index: 2,
		});

		expect(chosen.context.selectedIndex).toBe(2);
	});
});
