import type { SelectorSlot, SelectorState } from "./terminal-selector-contract";
import {
	formatCost,
	formatModelName,
	formatTotalCostLabel,
	getReadyCount,
	getTotalCost,
} from "./terminal-selector-helpers";

export type SelectorHintAction =
	| "navigate"
	| "confirm"
	| "clickConfirm"
	| "edit"
	| "refine"
	| "quit";

export type SelectorHintTarget = "cli" | "web";

export interface SelectorCopy {
	runningLabel: string;
	selectionLabel: string;
	itemLabelSingular: string;
	itemLabelPlural: string;
}

export interface SelectorCapabilities {
	clickConfirm: boolean;
	edit: boolean;
	refine: boolean;
}

interface SelectorHeaderViewModel {
	mode: "running" | "done";
	spinner?: string;
	progress: string;
	totalCostLabel?: string;
	runningLabel: string;
	generatedLabel: string;
}

interface SelectorHintViewModel {
	kind: "ready" | "empty";
	selectionLabel?: string;
	actions: SelectorHintAction[];
}

export interface SelectorSlotViewModel {
	status: SelectorSlot["status"];
	selected: boolean;
	radio: "○" | "●";
	title: string;
	meta?: string;
	muted: boolean;
}

export interface SelectorViewModel {
	header: SelectorHeaderViewModel;
	hint: SelectorHintViewModel;
	slots: SelectorSlotViewModel[];
	editedSummary?: string;
}

export interface BuildSelectorViewModelInput {
	state: Pick<
		SelectorState,
		"slots" | "selectedIndex" | "isGenerating" | "totalSlots"
	>;
	nowMs: number;
	spinnerFrames?: readonly string[];
	copy?: Partial<SelectorCopy>;
	capabilities?: Partial<SelectorCapabilities>;
	editedSelections?: Map<string, string>;
}

const DEFAULT_SPINNER_FRAMES = [
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
] as const;

const HINT_ACTION_ORDER: SelectorHintAction[] = [
	"navigate",
	"confirm",
	"clickConfirm",
	"edit",
	"refine",
	"quit",
];

const HINT_ACTION_GROUPS: SelectorHintAction[][] = [
	["navigate", "confirm", "clickConfirm"],
	["edit", "refine"],
	["quit"],
];

const DEFAULT_HINT_LABELS: Record<
	SelectorHintTarget,
	Record<SelectorHintAction, string>
> = {
	cli: {
		navigate: "↑↓ navigate",
		confirm: "⏎ confirm",
		clickConfirm: "click confirm",
		edit: "(e)dit",
			refine: "(r)efine",
		quit: "(q)uit",
	},
	web: {
		navigate: "↑↓ navigate",
		confirm: "enter confirm",
		clickConfirm: "click confirm",
		edit: "(e)dit",
			refine: "(r)efine",
		quit: "(q)uit",
	},
};

const SELECTOR_HINT_ACTION_LABELS = DEFAULT_HINT_LABELS;

const DEFAULT_SELECTOR_COPY: SelectorCopy = {
	runningLabel: "Generating commit messages...",
	selectionLabel: "Select a commit message",
	itemLabelSingular: "commit message",
	itemLabelPlural: "commit messages",
};

const DEFAULT_SELECTOR_CAPABILITIES: SelectorCapabilities = {
	clickConfirm: false,
	edit: false,
	refine: false,
};

function formatDuration(ms: number): string {
	const safeMs = Math.max(0, Math.round(ms));
	if (safeMs < 1000) {
		return `${safeMs}ms`;
	}
	const seconds = (safeMs / 1000).toFixed(1).replace(/\.0$/, "");
	return `${seconds}s`;
}

export function formatSelectorHintActions(
	actions: SelectorHintAction[],
	target: SelectorHintTarget,
	options: {
		separator?: string;
	} = {},
): string {
	const labels = SELECTOR_HINT_ACTION_LABELS[target];
	const ordered = normalizeHintActions(actions);
	if (options.separator) {
		return ordered.map((action) => labels[action]).join(options.separator);
	}
	return HINT_ACTION_GROUPS.map((group) =>
		group
			.filter((action) => ordered.includes(action))
			.map((action) => labels[action])
			.join(" "),
	)
		.filter((groupText) => groupText !== "")
		.join(" | ");
}

function normalizeHintActions(
	actions: SelectorHintAction[],
): SelectorHintAction[] {
	const set = new Set(actions);
	const ordered: SelectorHintAction[] = [];
	for (const action of HINT_ACTION_ORDER) {
		if (set.has(action)) {
			ordered.push(action);
		}
	}
	return ordered;
}

function resolveHintActions(input: {
	readyCount: number;
	capabilities: SelectorCapabilities;
}): SelectorHintAction[] {
	const actions: SelectorHintAction[] = ["navigate", "confirm", "quit"];
	if (input.capabilities.clickConfirm) {
		actions.push("clickConfirm");
	}
	if (input.capabilities.edit) {
		actions.push("edit");
	}
	if (input.capabilities.refine) {
		actions.push("refine");
	}
	return normalizeHintActions(actions);
}

function formatReadyMeta(
	slot: Extract<SelectorSlot, { status: "ready" }>,
): string {
	const { candidate } = slot;
	if (!candidate.model) {
		return "";
	}
	const formattedModel = formatModelName(candidate.model);
	const formattedDuration =
		candidate.generationMs == null
			? ""
			: ` ${formatDuration(candidate.generationMs)}`;
	if (candidate.cost != null) {
		return `${formattedModel} ${formatCost(candidate.cost)}${formattedDuration}`;
	}
	return `${formattedModel}${formattedDuration}`;
}

function createSlotViewModel(
	slot: SelectorSlot,
	index: number,
	selectedIndex: number,
): SelectorSlotViewModel {
	if (slot.status === "pending") {
		return {
			status: "pending",
			selected: false,
			radio: "○",
			title: "Generating...",
			meta: slot.model ? formatModelName(slot.model) : undefined,
			muted: true,
		};
	}

	if (slot.status === "error") {
		return {
			status: "error",
			selected: false,
			radio: "○",
			title: slot.content,
			muted: true,
		};
	}

	const selected = index === selectedIndex;
	const title = slot.candidate.content.split("\n")[0]?.trim() || "";
	const meta = formatReadyMeta(slot);
	return {
		status: "ready",
		selected,
		radio: selected ? "●" : "○",
		title,
		meta: meta || undefined,
		muted: !selected,
	};
}

function resolveEditedSummary(
	input: Pick<BuildSelectorViewModelInput, "state" | "editedSelections">,
): string | undefined {
	const selectedSlot = input.state.slots[input.state.selectedIndex];
	if (selectedSlot?.status !== "ready") {
		return undefined;
	}
	const edited = input.editedSelections?.get(selectedSlot.candidate.slotId);
	if (!edited) {
		return undefined;
	}
	return edited.split("\n")[0]?.slice(0, 120) || "";
}

export function buildSelectorViewModel(
	input: BuildSelectorViewModelInput,
): SelectorViewModel {
	const spinnerFrames = input.spinnerFrames ?? DEFAULT_SPINNER_FRAMES;
	const copy = { ...DEFAULT_SELECTOR_COPY, ...input.copy };
	const capabilities = {
		...DEFAULT_SELECTOR_CAPABILITIES,
		...input.capabilities,
	};
	const readyCount = getReadyCount(input.state.slots);
	const totalCost = getTotalCost(input.state.slots);
	const frame = Math.floor(input.nowMs / 80) % spinnerFrames.length;
	const generatedLabel =
		readyCount === 1
			? `Generated 1 ${copy.itemLabelSingular}`
			: `Generated ${readyCount} ${copy.itemLabelPlural}`;
	const hintActions = resolveHintActions({
		readyCount,
		capabilities,
	});

	return {
		header: {
			mode: input.state.isGenerating ? "running" : "done",
			spinner: spinnerFrames[frame],
			progress: `${readyCount}/${input.state.totalSlots}`,
			totalCostLabel:
				totalCost > 0 ? formatTotalCostLabel(totalCost) : undefined,
			runningLabel: copy.runningLabel,
			generatedLabel,
		},
		hint: {
			kind: readyCount > 0 ? "ready" : "empty",
			selectionLabel: readyCount > 0 ? copy.selectionLabel : undefined,
			actions: hintActions,
		},
		slots: input.state.slots.map((slot, index) =>
			createSlotViewModel(slot, index, input.state.selectedIndex),
		),
		editedSummary: resolveEditedSummary(input),
	};
}
