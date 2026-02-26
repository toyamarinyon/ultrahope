import { describe, expect, it } from "bun:test";
import type {
	SelectorSlot,
	SelectorState,
} from "../../../shared/terminal-selector-contract";
import { buildSelectorViewModel } from "../../../shared/terminal-selector-view-model";
import { renderSelectorLines } from "./terminal-selector";

function createState(overrides: Partial<SelectorState>): SelectorState {
	return {
		slots: [],
		selectedIndex: 0,
		isGenerating: false,
		totalSlots: 1,
		createdAtMs: 0,
		...overrides,
	};
}

function readySlot(overrides: Partial<SelectorSlot> = {}): SelectorSlot {
	return {
		status: "ready",
		candidate: {
			content: "feat: add selector metadata",
			slotId: "slot-0",
			model: "openai/gpt-5-mini",
		},
		...overrides,
	} as SelectorSlot;
}

describe("terminal-selector-view-model", () => {
	it("builds running header with spinner, progress, and total cost", () => {
		const state = createState({
			slots: [
				readySlot({
					candidate: {
						content: "feat: add selector metadata",
						slotId: "slot-0",
						model: "openai/gpt-5-mini",
						cost: 0.000001,
					},
				}),
				{ status: "pending", slotId: "slot-1" },
				{ status: "pending", slotId: "slot-2" },
			],
			isGenerating: true,
			totalSlots: 3,
		});

		const viewModel = buildSelectorViewModel({
			state,
			nowMs: 80,
			spinnerFrames: ["a", "b"],
		});

		expect(viewModel.header.mode).toBe("running");
		expect(viewModel.header.spinner).toBe("b");
		expect(viewModel.header.progress).toBe("1/3");
		expect(viewModel.header.totalCostLabel).toBe("$0.000001");
	});

	it("builds done header with singular and plural generated labels", () => {
		const oneReady = buildSelectorViewModel({
			state: createState({ slots: [readySlot()] }),
			nowMs: 0,
		});
		const twoReady = buildSelectorViewModel({
			state: createState({ slots: [readySlot(), readySlot()] }),
			nowMs: 0,
		});

		expect(oneReady.header.generatedLabel).toBe("Generated 1 commit message");
		expect(twoReady.header.generatedLabel).toBe("Generated 2 commit messages");
	});

	it("derives hint actions from capabilities in canonical order", () => {
		const viewModel = buildSelectorViewModel({
			state: createState({ slots: [readySlot()] }),
			nowMs: 0,
			capabilities: {
				clickConfirm: true,
				edit: true,
				refine: true,
			},
		});

		expect(viewModel.hint.actions).toEqual([
			"navigate",
			"confirm",
			"clickConfirm",
			"edit",
			"reroll",
			"refine",
			"quit",
		]);
	});

	it("uses quit-only hints when no ready slots exist", () => {
		const viewModel = buildSelectorViewModel({
			state: createState({
				slots: [
					{ status: "pending", slotId: "slot-0" },
					{ status: "pending", slotId: "slot-1" },
				],
				totalSlots: 2,
			}),
			nowMs: 0,
		});

		expect(viewModel.hint.kind).toBe("empty");
		expect(viewModel.hint.actions).toEqual(["quit"]);
	});

	it("keeps pending and error slot marks unselected", () => {
		const pendingSelected = buildSelectorViewModel({
			state: createState({
				slots: [
					{ status: "pending", slotId: "slot-0" },
					{
						status: "error",
						slotId: "slot-1",
						content: "Generation failed",
						error: "boom",
					},
				],
				selectedIndex: 0,
				totalSlots: 2,
			}),
			nowMs: 0,
		});
		const errorSelected = buildSelectorViewModel({
			state: createState({
				slots: [
					{ status: "pending", slotId: "slot-0" },
					{
						status: "error",
						slotId: "slot-1",
						content: "Generation failed",
						error: "boom",
					},
				],
				selectedIndex: 1,
				totalSlots: 2,
			}),
			nowMs: 0,
		});

		expect(pendingSelected.slots[0].radio).toBe("○");
		expect(pendingSelected.slots[0].selected).toBe(false);
		expect(errorSelected.slots[1].radio).toBe("○");
		expect(errorSelected.slots[1].selected).toBe(false);
	});

	it("formats ready slot metadata as model, cost, and duration", () => {
		const viewModel = buildSelectorViewModel({
			state: createState({
				slots: [
					{
						status: "ready",
						candidate: {
							content: "feat: add metadata line",
							slotId: "slot-0",
							model: "xai/grok-code-fast-1",
							cost: 0.1234567,
							generationMs: 1600,
						},
					},
				],
			}),
			nowMs: 0,
		});

		expect(viewModel.slots[0].meta).toBe("grok-code-fast-1 $0.1234567 1.6s");
	});

	it("includes edited summary when selected slot was edited", () => {
		const viewModel = buildSelectorViewModel({
			state: createState({
				slots: [readySlot()],
				selectedIndex: 0,
			}),
			nowMs: 0,
			editedSelections: new Map([
				["slot-0", "feat: edited title\n\nLong body paragraph"],
			]),
		});

		expect(viewModel.editedSummary).toBe("feat: edited title");
	});

	it("renders default ready hint as actions only in renderSelectorLines", () => {
		const readyState = createState({
			slots: [readySlot()],
			totalSlots: 1,
		});

		const readyLines = renderSelectorLines(readyState, 0);

		const hintLine = "↑↓ navigate enter confirm | (r)eroll | (q)uit";
		const hintIndex = readyLines.indexOf(hintLine);
		const summaryLineIndex = readyLines.findIndex((line) =>
			line.includes("feat: add selector metadata"),
		);

		expect(hintIndex).toBeGreaterThan(-1);
		expect(summaryLineIndex).toBeGreaterThan(-1);
		expect(hintIndex).toBeGreaterThan(summaryLineIndex);
		expect(hintIndex).toBeGreaterThan(1);
	});

	it("prioritizes legacy hint options in renderSelectorLines", () => {
		const readyState = createState({
			slots: [readySlot()],
			totalSlots: 1,
		});
		const noReadyState = createState({
			slots: [{ status: "pending", slotId: "slot-0" }],
			totalSlots: 1,
		});

		const readyLines = renderSelectorLines(readyState, 0, {
			hasReadyHint: "READY HINT",
			copy: {
				selectionLabel: "Select a candidate",
			},
		});
		const noReadyLines = renderSelectorLines(noReadyState, 0, {
			noReadyHint: "NONE HINT",
		});

		const readyHintIndex = readyLines.indexOf("READY HINT");
		const readyCandidateIndex = readyLines.findIndex(
			(line) => line.startsWith("○") || line.startsWith("●"),
		);
		const noReadyHintIndex = noReadyLines.indexOf("NONE HINT");
		const noReadyCandidateIndex = noReadyLines.findIndex((line) =>
			line.startsWith("○"),
		);

		expect(readyHintIndex).toBeGreaterThan(-1);
		expect(readyCandidateIndex).toBeGreaterThan(-1);
		expect(readyHintIndex).toBeGreaterThan(readyCandidateIndex);
		expect(noReadyHintIndex).toBeGreaterThan(-1);
		expect(noReadyCandidateIndex).toBeGreaterThan(-1);
		expect(noReadyHintIndex).toBeGreaterThan(noReadyCandidateIndex);
	});
});
