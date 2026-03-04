import {
	renderSelectorTextFromRenderFrame,
	SPINNER_FRAMES,
} from "../../cli/lib/renderer";
import { ui } from "../../cli/lib/ui";
import type { SelectorSlot } from "../../shared/terminal-selector-contract";
import {
	type BuildSelectorViewModelInput,
	selectorRenderFrame,
} from "../../shared/terminal-selector-view-model";
import type { Story } from "./types";

const selectorCreatedAtMs = 1_700_000_000_000;
const selectorCopy = {
	runningLabel: "Generating commit messages...",
	itemLabelPlural: "commit messages",
	itemLabelSingular: "commit message",
	selectionLabel: "Select a commit message",
};

const selectorCapabilities = {
	edit: true,
	refine: true,
	escalate: true,
	clickConfirm: false,
};

type ReadySlot = Extract<SelectorSlot, { status: "ready" }>;
type PendingSlot = Extract<SelectorSlot, { status: "pending" }>;
type ErrorSlot = Extract<SelectorSlot, { status: "error" }>;

interface SelectorStoryInput {
	name: string;
	state: BuildSelectorViewModelInput["state"];
	animated?: boolean;
}

function buildSelectorText(
	state: BuildSelectorViewModelInput["state"],
	nowMs: number,
): string {
	return renderSelectorTextFromRenderFrame(
		selectorRenderFrame({
			state,
			nowMs,
			spinnerFrames: SPINNER_FRAMES,
			copy: selectorCopy,
			capabilities: selectorCapabilities,
		}),
	);
}

function createSelectorStory(input: SelectorStoryInput): Story {
	const { name, state, animated = false } = input;

	const render = (_columns: number) =>
		buildSelectorText(state, selectorCreatedAtMs + 240);

	if (!animated) {
		return { name, render };
	}

	return {
		name,
		render,
		animate: (tick, _columns) =>
			buildSelectorText(state, selectorCreatedAtMs + 240 + tick * 80),
	};
}

function readySlot(
	slotId: string,
	content: string,
	options: {
		model?: string;
		cost?: number;
		generationMs?: number;
	} = {},
): ReadySlot {
	return {
		status: "ready",
		candidate: {
			content,
			slotId,
			model: options.model,
			cost: options.cost,
			generationMs: options.generationMs,
		},
	};
}

function pendingSlot(slotId: string, model?: string): PendingSlot {
	return {
		status: "pending",
		slotId,
		model,
	};
}

function errorSlot(slotId: string, content: string, model?: string): ErrorSlot {
	return {
		status: "error",
		slotId,
		content,
		model,
		error: "generation failed",
	};
}

const generatingState: BuildSelectorViewModelInput["state"] = {
	slots: [
		readySlot("slot-1", "feat: add login page", {
			model: "gpt-4.1",
			cost: 0.0009,
			generationMs: 900,
		}),
		readySlot("slot-2", "fix: handle null response from API", {
			model: "gpt-4.1-mini",
			cost: 0.0011,
			generationMs: 1100,
		}),
		pendingSlot("slot-3", "gpt-4.1"),
		pendingSlot("slot-4", "claude-3.5-sonnet"),
	],
	selectedIndex: 0,
	isGenerating: true,
	totalSlots: 4,
	createdAtMs: selectorCreatedAtMs,
};

const allReadyState: BuildSelectorViewModelInput["state"] = {
	slots: [
		readySlot("slot-1", "feat: add login page", {
			model: "gpt-4.1",
			cost: 0.0009,
			generationMs: 900,
		}),
		readySlot("slot-2", "fix: handle null response from API", {
			model: "gpt-4.1-mini",
			cost: 0.0011,
			generationMs: 1100,
		}),
		readySlot("slot-3", "chore: cleanup old logs in CI", {
			model: "claude-3.5-sonnet",
			cost: 0.0012,
			generationMs: 1210,
		}),
		readySlot("slot-4", "refactor: extract commit message builder", {
			model: "gemini-2.5-pro",
			cost: 0.0007,
			generationMs: 700,
		}),
	],
	selectedIndex: 0,
	isGenerating: false,
	totalSlots: 4,
	createdAtMs: selectorCreatedAtMs - 1500,
};

const escalatedGeneratingState: BuildSelectorViewModelInput["state"] = {
	slots: [
		readySlot("slot-1", "feat: add user login page with session handling", {
			model: "claude-sonnet-4-20250514",
			cost: 0.0032,
			generationMs: 1800,
		}),
		pendingSlot("slot-2", "gpt-4.1"),
		pendingSlot("slot-3", "gemini-2.5-pro"),
		pendingSlot("slot-4", "claude-sonnet-4-20250514"),
	],
	selectedIndex: 0,
	isGenerating: true,
	totalSlots: 4,
	createdAtMs: selectorCreatedAtMs + 2000,
};

function buildEscalateText(
	prevState: BuildSelectorViewModelInput["state"],
	escalatedState: BuildSelectorViewModelInput["state"],
	nowMs: number,
): string {
	const prevFrame = selectorRenderFrame({
		state: prevState,
		nowMs,
		spinnerFrames: SPINNER_FRAMES,
		copy: selectorCopy,
		capabilities: selectorCapabilities,
	});
	const costSuffix = prevFrame.viewModel.header.totalCostLabel
		? ` (total: ${prevFrame.viewModel.header.totalCostLabel})`
		: "";
	const generatedLine = `${prevFrame.viewModel.header.generatedLabel}${costSuffix}`;
	const header = `${ui.success(generatedLine)}\n${ui.hint("  -> Escalate")}\n`;
	const escalatedSelector = buildSelectorText(escalatedState, nowMs);
	return `${header}${escalatedSelector}`;
}

export const selectorStories: Story[] = [
	createSelectorStory({
		name: "selector: generating 2/4",
		state: generatingState,
		animated: true,
	}),
	createSelectorStory({
		name: "selector: all ready (first selected)",
		state: allReadyState,
	}),
	createSelectorStory({
		name: "selector: all ready (non-first selected)",
		state: {
			...allReadyState,
			selectedIndex: 2,
		},
	}),
	createSelectorStory({
		name: "selector: with cost and generation time",
		state: {
			...allReadyState,
			isGenerating: false,
			createdAtMs: selectorCreatedAtMs - 1800,
		},
	}),
	createSelectorStory({
		name: "selector: slot with error",
		state: {
			...allReadyState,
			slots: [
				readySlot("slot-1", "feat: add login page", {
					model: "gpt-4.1",
					cost: 0.0009,
					generationMs: 900,
				}),
				errorSlot(
					"slot-2",
					"Timeout while generating candidate",
					"gpt-4.1-mini",
				),
				readySlot("slot-3", "refactor: extract commit message builder", {
					model: "claude-3.5-sonnet",
					cost: 0.0012,
					generationMs: 1210,
				}),
				pendingSlot("slot-4", "gemini-2.5-pro"),
			],
			selectedIndex: 2,
			isGenerating: true,
			createdAtMs: selectorCreatedAtMs - 2000,
		},
	}),
	createSelectorStory({
		name: "selector: prompt refine",
		state: {
			...allReadyState,
			mode: "prompt",
			promptKind: "refine",
			promptTargetIndex: 1,
			isGenerating: false,
		},
	}),
	createSelectorStory({
		name: "selector: prompt edit",
		state: {
			...allReadyState,
			mode: "prompt",
			promptKind: "edit",
			promptTargetIndex: 0,
			isGenerating: false,
			selectedIndex: 1,
		},
	}),
	{
		name: "selector: escalate (Generated -> Escalate)",
		render: (_columns: number) =>
			buildEscalateText(
				allReadyState,
				escalatedGeneratingState,
				selectorCreatedAtMs + 240,
			),
		animate: (tick, _columns) =>
			buildEscalateText(
				allReadyState,
				escalatedGeneratingState,
				escalatedGeneratingState.createdAtMs + tick * 80,
			),
	},
];
