export interface QuotaInfo {
	remaining: number;
	limit: number;
	resetsAt: string;
}

export interface CandidateWithModel {
	content: string;
	slotId: string;
	model?: string;
	cost?: number;
	generationMs?: number;
	generationId?: string;
	quota?: QuotaInfo;
	isPartial?: boolean;
	slotIndex?: number;
}

interface SelectorSlotPending {
	status: "pending";
	slotId: string;
	model?: string;
}

interface SelectorSlotReady {
	status: "ready";
	candidate: CandidateWithModel;
}

interface SelectorSlotError {
	status: "error";
	slotId: string;
	content: string;
	error: string;
	model?: string;
}

export type SelectorSlot =
	| SelectorSlotPending
	| SelectorSlotReady
	| SelectorSlotError;

export type CreateCandidates = (
	signal: AbortSignal,
	guideHint?: string,
) => AsyncIterable<CandidateWithModel>;

export type SelectorFlowMode = "list" | "prompt";

export type ListMode = "initial" | "refined";

export type PromptKind = "edit" | "refine";

export interface SelectorFlowContext {
	mode: SelectorFlowMode;
	listMode: ListMode;
	slots: SelectorSlot[];
	selectedIndex: number;
	isGenerating: boolean;
	totalSlots: number;
	createdAtMs: number;
	editedSelections: Map<string, string>;
	promptKind?: PromptKind;
	promptTargetIndex?: number;
	guideHint?: string;
}

export type SelectorFlowEvent =
	| { type: "GENERATE_START" }
	| { type: "GENERATE_DONE" }
	| { type: "CANCEL_GENERATION" }
	| { type: "CHOOSE_INDEX"; index: number }
	| { type: "NAVIGATE"; direction: -1 | 1 }
	| { type: "OPEN_PROMPT"; kind: PromptKind }
	| { type: "PROMPT_SUBMIT"; guide?: string; selectedContent?: string }
	| { type: "PROMPT_CANCEL" }
	| { type: "CONFIRM" }
	| { type: "QUIT" };

export type SelectorFlowAbortReason = "exit" | "discard_refine";

export interface SelectorFlowResult {
	action: SelectorResult["action"] | "return";
	selected?: string;
	selectedIndex?: number;
	selectedCandidate?: CandidateWithModel;
	guide?: string;
	totalCost?: number;
	quota?: QuotaInfo;
	error?: unknown;
	abortReason?: SelectorFlowAbortReason;
}

export interface SelectorFlowEffect {
	type: "startGeneration" | "cancelGeneration";
}

export interface SelectorFlowTransition {
	context: SelectorFlowContext;
	effects: SelectorFlowEffect[];
	result?: SelectorFlowResult;
}

export interface SelectorState {
	slots: SelectorSlot[];
	selectedIndex: number;
	isGenerating: boolean;
	totalSlots: number;
	createdAtMs: number;
}

export interface SelectorResult {
	action: "confirm" | "abort" | "refine" | "return";
	selected?: string;
	selectedIndex?: number;
	selectedCandidate?: CandidateWithModel;
	guide?: string;
	totalCost?: number;
	quota?: QuotaInfo;
	error?: unknown;
	abortReason?: SelectorFlowAbortReason;
}

export interface TerminalSelectorOptions {
	maxSlots: number;
	models?: string[];
	createCandidates: CreateCandidates;
	onState?: (state: SelectorState) => void;
	onPrompt?: (input: {
		kind: PromptKind;
		promptTargetIndex: number;
		guideHint?: string;
		selectionText?: string;
	}) => Promise<string | null | undefined> | string | null | undefined;
}

export interface TerminalSelectorController {
	readonly state: SelectorState;
	start: () => void;
	abort: () => SelectorResult;
	confirm: () => SelectorResult | null;
	moveSelection: (direction: -1 | 1) => void;
	setSelection: (index: number) => void;
	handleKey: (input: {
		key: string;
		ctrlKey?: boolean;
	}) => SelectorResult | null;
	destroy: () => void;
	subscribe: (listener: (state: SelectorState) => void) => () => void;
}
