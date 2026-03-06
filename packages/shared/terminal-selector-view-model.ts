import type {
	PromptKind,
	SelectorFlowContext,
	SelectorSlot,
	SelectorState,
} from "./terminal-selector-contract";
import {
	formatCost,
	formatModelName,
	formatTotalCostLabel,
	getReadyCount,
	getTotalCost,
	normalizeCandidateContentForDisplay,
} from "./terminal-selector-helpers";

export type SelectorHintAction =
	| "navigate"
	| "confirm"
	| "clickConfirm"
	| "edit"
	| "refine"
	| "escalate"
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
	escalate: boolean;
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
	radio: "○" | "●" | ">";
	title: string;
	meta?: string;
	muted: boolean;
}

export interface SelectorViewModel {
	mode: "list" | "prompt";
	header: SelectorHeaderViewModel;
	hint: SelectorHintViewModel;
	slots: SelectorSlotViewModel[];
	editedSummary?: string;
}

export interface SelectorPromptViewModel {
	kind: PromptKind;
	generatedLine: string;
	selectedLine?: string;
	modeLine: string;
	targetLineLabel: string;
	targetText: string;
	targetIndex: number;
	costLine: string;
	questionLine: string;

	slots: SelectorSlotViewModel[];
	promptLineCount: number;
	promptInputLineIndex: number;
	promptInputPrefix: string;
	promptInputPrefixWidth: number;
	promptInputText: string;
	promptPlaceholderLine?: string;
	promptHintLine: string;
}

export interface SelectorRenderFrame {
	mode: "list" | "prompt";
	viewModel: SelectorViewModel;
	prompt?: SelectorPromptViewModel;
}

export type SelectorRenderLine =
	| {
			type: "headerRunning";
			spinner: string;
			label: string;
			progress: string;
			costSuffix: string;
	  }
	| { type: "headerDone"; label: string; costSuffix: string }
	| { type: "blank" }
	| {
			type: "slot";
			radio: "○" | "●" | ">";
			title: string;
			selected: boolean;
			muted: boolean;
	  }
	| { type: "slotMeta"; text: string; muted: boolean }
	| { type: "promptInput"; prefix: string; text: string }
	| { type: "placeholder"; text: string }
	| {
			type: "hint";
			text: string;
			actions: SelectorHintAction[];
			readyCount: number;
	  }
	| { type: "editedSummary"; text: string };

export interface BuildSelectorViewModelInput {
	state: Pick<
		SelectorState,
		"slots" | "selectedIndex" | "isGenerating" | "totalSlots" | "createdAtMs"
	> &
		Partial<
			Pick<SelectorFlowContext, "mode" | "promptKind" | "promptTargetIndex">
		>;
	nowMs: number;
	bufferText?: string;
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
	"escalate",
	"quit",
];

const HINT_ACTION_GROUPS: SelectorHintAction[][] = [
	["navigate", "confirm", "clickConfirm"],
	["edit", "refine", "escalate"],
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
		escalate: "(E)scalate",
		quit: "(q)uit",
	},
	web: {
		navigate: "↑↓ navigate",
		confirm: "⏎ confirm",
		clickConfirm: "click confirm",
		edit: "(e)dit",
		refine: "(r)efine",
		escalate: "(E)scalate",
		quit: "(q)uit",
	},
};

const SELECTOR_HINT_ACTION_LABELS = DEFAULT_HINT_LABELS;
const PROMPT_EDIT_HINT = "enter apply | esc back to select";
const PROMPT_REFINE_HINT = "enter refine | esc back to select";
const PROMPT_EDIT_PREFIX = "  > ";
const PROMPT_REFINE_PREFIX = "  Refine: ";
const PROMPT_REFINE_PLACEHOLDER = "e.g. more formal / shorter / in Japanese";

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
	escalate: false,
};

function formatDuration(ms: number): string {
	const safeMs = Math.max(0, Math.round(ms));
	if (safeMs < 1000) {
		return `${safeMs}ms`;
	}
	const seconds = (safeMs / 1000).toFixed(1).replace(/\.0$/, "");
	return `${seconds}s`;
}

function resolveRenderMode(
	inputState: BuildSelectorViewModelInput["state"],
): "list" | "prompt" {
	return inputState.mode === "prompt" ? "prompt" : "list";
}

function resolvePromptLineLabel(kind: PromptKind): string {
	return kind === "edit" ? "Edit mode" : "→ Refine mode";
}

function buildPromptSlots(
	viewModelSlots: SelectorSlotViewModel[],
	promptKind: PromptKind,
	targetIndex: number,
	bufferText: string,
): SelectorSlotViewModel[] {
	if (promptKind === "edit") {
		return viewModelSlots.map((slot, index) => {
			const isTarget = index === targetIndex;
			return {
				...slot,
				radio: isTarget ? ">" : "○",
				title: isTarget ? bufferText : slot.title,
				selected: isTarget,
				muted: isTarget ? false : slot.muted,
			};
		});
	}

	return viewModelSlots;
}

function estimatePromptSlotLineCount(slots: SelectorSlotViewModel[]): number {
	let count = 1;
	for (const slot of slots) {
		const lineCount = 1 + (slot.meta == null ? 0 : 1) + 1;
		count += lineCount;
	}
	return count;
}

function estimatePromptEditInputLineIndex(
	promptSlots: SelectorSlotViewModel[],
	targetIndex: number,
): number {
	let lineIndex = 2;
	for (const [index, slot] of promptSlots.entries()) {
		if (index === targetIndex) {
			return lineIndex;
		}
		const slotLineCount = 1 + (slot.meta == null ? 0 : 1) + 1;
		lineIndex += slotLineCount;
	}

	return Math.max(2, lineIndex);
}

function buildPromptViewModel(
	input: Pick<BuildSelectorViewModelInput, "state" | "nowMs" | "bufferText">,
	viewModel: SelectorViewModel,
): SelectorPromptViewModel {
	const state = input.state;
	const promptKind = state.promptKind ?? "refine";
	const targetIndex = state.promptTargetIndex ?? state.selectedIndex;
	const targetSlot = state.slots[targetIndex];
	const targetText =
		targetSlot?.status === "ready"
			? normalizeCandidateContentForDisplay(targetSlot.candidate.content)
			: "(no selection)";
	const totalCost = getTotalCost(state.slots);
	const costLineLabel =
		totalCost > 0 ? formatTotalCostLabel(totalCost) : "$0.000000";
	const generatedCostSuffix = viewModel.header.totalCostLabel
		? ` (total: ${viewModel.header.totalCostLabel})`
		: "";
	const generatedLine = `${viewModel.header.generatedLabel}${generatedCostSuffix}`;
	const modeLine = resolvePromptLineLabel(promptKind);
	const targetLineLabel = `Target [${Math.min(state.totalSlots, targetIndex + 1)}]:`;
	const duration = formatDuration(input.nowMs - state.createdAtMs);
	const costLine = `Cost/Time (current): ${costLineLabel} / ${duration}`;
	const isEdit = promptKind === "edit";
	const promptInputPrefix = isEdit ? PROMPT_EDIT_PREFIX : PROMPT_REFINE_PREFIX;
	const promptHintLine = isEdit ? PROMPT_EDIT_HINT : PROMPT_REFINE_HINT;
	const promptPlaceholderLine = isEdit ? undefined : PROMPT_REFINE_PLACEHOLDER;
	const promptInputText = input.bufferText ?? "";
	const promptSlots = buildPromptSlots(
		viewModel.slots,
		promptKind,
		targetIndex,
		promptInputText,
	);
	const promptSlotLineCount = estimatePromptSlotLineCount(promptSlots);
	const promptExtraLines = isEdit ? 1 : 4;
	const promptLineCount = 1 + promptSlotLineCount + promptExtraLines;
	const promptInputLineIndex = isEdit
		? estimatePromptEditInputLineIndex(promptSlots, targetIndex)
		: promptLineCount - promptExtraLines;
	const promptInputPrefixWidth = promptInputPrefix.length;

	const selectedLine =
		promptKind === "edit" ? `Selected: ${targetText}` : undefined;

	return {
		kind: promptKind,
		generatedLine,
		selectedLine,
		modeLine,
		targetLineLabel,
		targetText,
		targetIndex,
		costLine,
		questionLine: "?",
		slots: promptSlots,
		promptLineCount,
		promptInputLineIndex,
		promptInputPrefix,
		promptInputPrefixWidth,
		promptInputText,
		promptPlaceholderLine,
		promptHintLine,
	};
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
	if (input.capabilities.escalate) {
		actions.push("escalate");
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
		mode: resolveRenderMode(input.state),
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

export function selectorRenderFrame(
	input: BuildSelectorViewModelInput,
): SelectorRenderFrame {
	const viewModel = buildSelectorViewModel(input);

	if (viewModel.mode === "prompt") {
		return {
			mode: "prompt",
			viewModel,
			prompt: buildPromptViewModel(input, viewModel),
		};
	}

	return {
		mode: "list",
		viewModel,
	};
}

function slotToRenderLines(slot: SelectorSlotViewModel): SelectorRenderLine[] {
	const lines: SelectorRenderLine[] = [
		{
			type: "slot",
			radio: slot.radio,
			title: slot.title,
			selected: slot.selected,
			muted: slot.muted,
		},
	];
	if (slot.meta) {
		lines.push({ type: "slotMeta", text: slot.meta, muted: slot.muted });
	}
	return lines;
}

function buildHeaderLine(viewModel: SelectorViewModel): SelectorRenderLine {
	const costSuffix =
		viewModel.header.totalCostLabel != null
			? ` (total: ${viewModel.header.totalCostLabel})`
			: "";

	if (viewModel.header.mode === "running") {
		return {
			type: "headerRunning",
			spinner: viewModel.header.spinner ?? "",
			label: viewModel.header.runningLabel,
			progress: viewModel.header.progress,
			costSuffix,
		};
	}
	return {
		type: "headerDone",
		label: viewModel.header.generatedLabel,
		costSuffix,
	};
}

function buildPromptRenderLines(
	frame: SelectorRenderFrame,
): SelectorRenderLine[] {
	const prompt = frame.prompt;
	if (!prompt) return [];

	const lines: SelectorRenderLine[] = [{ type: "blank" }];
	for (const slot of prompt.slots) {
		lines.push(...slotToRenderLines(slot));
		lines.push({ type: "blank" });
	}

	if (prompt.kind === "refine") {
		lines.push({
			type: "promptInput",
			prefix: prompt.promptInputPrefix,
			text: prompt.promptInputText,
		});
		if (prompt.promptPlaceholderLine != null) {
			lines.push({ type: "placeholder", text: prompt.promptPlaceholderLine });
			lines.push({ type: "blank" });
		}
	}
	lines.push({
		type: "hint",
		text: prompt.promptHintLine,
		actions: [],
		readyCount: 0,
	});
	return lines;
}

function buildListRenderLines(
	viewModel: SelectorViewModel,
): SelectorRenderLine[] {
	const lines: SelectorRenderLine[] = [{ type: "blank" }];
	for (const slot of viewModel.slots) {
		lines.push(...slotToRenderLines(slot));
		lines.push({ type: "blank" });
	}

	if (viewModel.editedSummary) {
		lines.push({ type: "blank" });
		lines.push({ type: "editedSummary", text: viewModel.editedSummary });
	}

	const readyCount = viewModel.slots.filter((s) => s.status === "ready").length;
	lines.push({
		type: "hint",
		text: "",
		actions: viewModel.hint.actions,
		readyCount,
	});
	return lines;
}

export function buildSelectorRenderLines(
	frame: SelectorRenderFrame,
): SelectorRenderLine[] {
	const lines: SelectorRenderLine[] = [buildHeaderLine(frame.viewModel)];

	if (frame.mode === "prompt") {
		lines.push(...buildPromptRenderLines(frame));
	} else {
		lines.push(...buildListRenderLines(frame.viewModel));
	}

	return lines;
}
