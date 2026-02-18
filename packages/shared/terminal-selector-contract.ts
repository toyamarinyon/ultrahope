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
	generationId?: string;
	quota?: QuotaInfo;
	isPartial?: boolean;
	slotIndex?: number;
}

export interface GenerateCommitMessageGenerationInput {
	diff: string;
	model: string;
	signal: AbortSignal;
	slotId: string;
	slotIndex: number;
}

export interface CommitMessageGenerationPort {
	generateCandidate(
		input: GenerateCommitMessageGenerationInput,
	): Promise<CandidateWithModel>;
}

export interface SelectorSlotPending {
	status: "pending";
	slotId: string;
	model?: string;
}

export interface SelectorSlotReady {
	status: "ready";
	candidate: CandidateWithModel;
}

export interface SelectorSlotError {
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
) => AsyncIterable<CandidateWithModel>;

export interface SelectorState {
	slots: SelectorSlot[];
	selectedIndex: number;
	isGenerating: boolean;
	totalSlots: number;
	createdAtMs: number;
}

export interface SelectorResult {
	action: "confirm" | "abort" | "reroll";
	selected?: string;
	selectedIndex?: number;
	selectedCandidate?: CandidateWithModel;
	totalCost?: number;
	quota?: QuotaInfo;
	error?: unknown;
}

export interface TerminalSelectorOptions {
	maxSlots: number;
	models?: string[];
	createCandidates: CreateCandidates;
	onState?: (state: SelectorState) => void;
}

export interface TerminalSelectorController {
	readonly state: SelectorState;
	start: () => void;
	abort: () => SelectorResult;
	reroll: () => SelectorResult | null;
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

export type GenerationSchedulerAction =
	| "start"
	| "abort"
	| "reroll"
	| "confirm";

export interface GenerationScheduler {
	start(): void;
	abort(): SelectorResult;
	reroll(): SelectorResult | null;
	confirm(): SelectorResult | null;
	onAction?(action: GenerationSchedulerAction): void;
}
