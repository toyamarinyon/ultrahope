"use client";

import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { SelectorSlot } from "../../shared/terminal-selector-contract";
import {
	type BuildSelectorViewModelInput,
	buildSelectorRenderLines,
	formatSelectorHintActions,
	type SelectorRenderLine,
	selectorRenderFrame,
} from "../../shared/terminal-selector-view-model";
import { TerminalWindow } from "./terminal-window";

type ControlStepId = "compare" | "edit" | "refine" | "escalate";

type ControlStep = {
	id: ControlStepId;
	title: string;
	description: string;
};

const CONTROL_STEPS: ControlStep[] = [
	{
		id: "compare",
		title: "Compare candidates",
		description:
			"Multiple proposals generated in parallel.\nPick the one that fits.",
	},
	{
		id: "edit",
		title: "Edit before commit",
		description:
			"Tweak the wording directly. Keep your\nvoice in every commit.",
	},
	{
		id: "refine",
		title: "Refine with instruction",
		description:
			"Tell the model what to change. It\nregenerates based on your guidance.",
	},
	{
		id: "escalate",
		title: "Escalate",
		description: "Not satisfied? Shift+e to escalate to a more\ncapable model.",
	},
];

const CREATED_AT_MS = 1_700_000_000_000;

function readySlot(
	slotId: string,
	content: string,
	options: { model?: string; cost?: number; generationMs?: number } = {},
): Extract<SelectorSlot, { status: "ready" }> {
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

const COMPARE_SLOTS: SelectorSlot[] = [
	readySlot(
		"slot-0",
		"feat(api): add stream event timestamps and metadata support",
		{ model: "ministral-3b", cost: 0.0001049, generationMs: 871 },
	),
	readySlot(
		"slot-1",
		"refactor(api): restructure stream event metadata handling",
		{ model: "ministral-3b", cost: 0.0001049, generationMs: 871 },
	),
	readySlot("slot-2", "fix(api): add missing timestamp to stream events", {
		model: "ministral-3b",
		cost: 0.0001049,
		generationMs: 871,
	}),
];

const REFINE_SLOTS: SelectorSlot[] = [
	readySlot(
		"slot-0",
		"fix(api): add atMs field to stream event payload for timestamp tracking",
		{ model: "ministral-3b", cost: 0.0001, generationMs: 893 },
	),
	readySlot(
		"slot-1",
		"fix(api): add missing atMs timestamp field to commit message stream events",
		{ model: "ministral-3b", cost: 0.0001, generationMs: 893 },
	),
];

function pendingSlot(
	slotId: string,
	model?: string,
): Extract<SelectorSlot, { status: "pending" }> {
	return { status: "pending", slotId, model };
}

const ESCALATE_SLOTS: SelectorSlot[] = [
	readySlot(
		"slot-0",
		"feat(api): add event timestamp and metadata support to streams",
		{ model: "claude-sonnet-4-20250514", cost: 0.0032, generationMs: 1800 },
	),
	pendingSlot("slot-1", "gpt-4.1"),
	pendingSlot("slot-2", "gemini-2.5-pro"),
	pendingSlot("slot-3", "claude-sonnet-4-20250514"),
];

function buildInput(
	slots: SelectorSlot[],
	selectedIndex: number,
	capabilities: {
		edit?: boolean;
		refine?: boolean;
		escalate?: boolean;
		clickConfirm?: boolean;
	},
	overrides?: Partial<BuildSelectorViewModelInput["state"]>,
): BuildSelectorViewModelInput {
	return {
		state: {
			slots,
			selectedIndex,
			isGenerating: false,
			totalSlots: slots.length,
			createdAtMs: CREATED_AT_MS,
			...overrides,
		},
		nowMs: CREATED_AT_MS + 240,
		copy: {
			runningLabel: "Generating commit messages...",
			itemLabelPlural: "commit messages",
			itemLabelSingular: "commit message",
		},
		capabilities,
	};
}

function buildLines(input: BuildSelectorViewModelInput): {
	lines: SelectorRenderLine[];
	slotIndices: Map<number, number>;
} {
	const frame = selectorRenderFrame(input);
	const lines = buildSelectorRenderLines(frame);
	const slotIndices = new Map<number, number>();
	let slotCounter = 0;
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].type === "slot") {
			slotIndices.set(i, slotCounter);
			slotCounter++;
		}
	}
	return { lines, slotIndices };
}

// --- Render a single SelectorRenderLine to React ---

function RenderLine({
	line,
	slotIndex,
	onHover,
	onClick,
	interactive,
	editableSlot,
	editablePrompt,
}: {
	line: SelectorRenderLine;
	slotIndex?: number;
	onHover?: (index: number) => void;
	onClick?: (index: number) => void;
	interactive?: boolean;
	editableSlot?: {
		value: string;
		onChange: (v: string) => void;
		onKeyDown: (e: React.KeyboardEvent) => void;
		inputRef: React.RefObject<HTMLInputElement | null>;
	};
	editablePrompt?: {
		value: string;
		onChange: (v: string) => void;
		onKeyDown: (e: React.KeyboardEvent) => void;
		inputRef: React.RefObject<HTMLInputElement | null>;
	};
}) {
	switch (line.type) {
		case "headerRunning":
			return (
				<div className="text-foreground-secondary">
					<span className="text-blue-400">{line.spinner}</span> {line.label}{" "}
					{line.progress}
					{line.costSuffix}
				</div>
			);
		case "headerDone":
			return (
				<div>
					<span className="text-emerald-400">✔</span>{" "}
					<span className="text-foreground">
						{line.label}
						{line.costSuffix}
					</span>
				</div>
			);
		case "blank":
			return <div className="h-2" />;
		case "slot": {
			if (line.radio === ">" && editableSlot) {
				return (
					<div className="pl-4">
						<span className="text-emerald-400">&gt;</span>{" "}
						<input
							ref={editableSlot.inputRef}
							type="text"
							value={editableSlot.value}
							onChange={(e) => editableSlot.onChange(e.target.value)}
							onKeyDown={editableSlot.onKeyDown}
							className="bg-transparent text-foreground font-bold outline-none border-none w-[calc(100%-2rem)] caret-emerald-400"
							aria-label="Edit commit message"
						/>
					</div>
				);
			}

			const content = (
				<>
					<span
						className={
							line.selected ? "text-emerald-400" : "text-foreground-muted/60"
						}
					>
						{line.radio}
					</span>{" "}
					<span
						className={
							line.selected
								? "text-foreground font-bold"
								: "text-foreground-muted/60"
						}
					>
						{line.title}
					</span>
				</>
			);

			if (interactive && slotIndex != null) {
				return (
					<button
						type="button"
						className="block w-full pl-4 text-left hover:bg-surface-hover rounded cursor-pointer"
						onMouseEnter={() => onHover?.(slotIndex)}
						onClick={() => onClick?.(slotIndex)}
					>
						{content}
					</button>
				);
			}

			return <div className="pl-4">{content}</div>;
		}
		case "slotMeta":
			return (
				<div
					className={`pl-8 ${line.muted ? "text-foreground-muted/60" : "text-foreground"}`}
				>
					{line.text}
				</div>
			);
		case "promptInput":
			if (editablePrompt) {
				return (
					<div>
						<span className="text-foreground">{line.prefix}</span>
						<input
							ref={editablePrompt.inputRef}
							type="text"
							value={editablePrompt.value}
							onChange={(e) => editablePrompt.onChange(e.target.value)}
							onKeyDown={editablePrompt.onKeyDown}
							className="bg-transparent text-foreground-secondary outline-none border-none w-[calc(100%-8rem)] caret-foreground"
							aria-label="Refine instruction"
						/>
					</div>
				);
			}
			return (
				<div>
					<span className="text-foreground">{line.prefix}</span>
					{line.text}
				</div>
			);
		case "placeholder":
			return <div className="text-foreground-muted/40">{line.text}</div>;
		case "hint":
			if (line.actions.length > 0) {
				const text = formatSelectorHintActions(line.actions, "web");
				return <div className="text-foreground-muted/60 pl-4">{text}</div>;
			}
			return <div className="text-foreground-muted/60 pl-4">{line.text}</div>;
		case "editedSummary":
			return (
				<div>
					<span className="text-emerald-400">Edited:</span> {line.text}
				</div>
			);
	}
}

function SelectorFrame({
	lines,
	slotIndices,
	onHover,
	onClick,
	interactive,
	editableSlot,
	editablePrompt,
}: {
	lines: SelectorRenderLine[];
	slotIndices?: Map<number, number>;
	onHover?: (index: number) => void;
	onClick?: (index: number) => void;
	interactive?: boolean;
	editableSlot?: {
		value: string;
		onChange: (v: string) => void;
		onKeyDown: (e: React.KeyboardEvent) => void;
		inputRef: React.RefObject<HTMLInputElement | null>;
	};
	editablePrompt?: {
		value: string;
		onChange: (v: string) => void;
		onKeyDown: (e: React.KeyboardEvent) => void;
		inputRef: React.RefObject<HTMLInputElement | null>;
	};
}) {
	return (
		<>
			{lines.map((line, lineIndex) => (
				<RenderLine
					key={`${line.type}-${lineIndex}`}
					line={line}
					slotIndex={slotIndices?.get(lineIndex)}
					onHover={onHover}
					onClick={onClick}
					interactive={interactive}
					editableSlot={editableSlot}
					editablePrompt={editablePrompt}
				/>
			))}
		</>
	);
}

// --- Demo toast ---

function useDemoToast(durationMs = 2000) {
	const [visible, setVisible] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const show = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		setVisible(true);
		timerRef.current = setTimeout(() => setVisible(false), durationMs);
	}, [durationMs]);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	return { visible, show };
}

function DemoToast({ visible }: { visible: boolean }) {
	if (!visible) return null;
	return (
		<div className="absolute right-4 bottom-4 font-mono text-xs text-foreground-muted/60">
			(disabled in demo)
		</div>
	);
}

// --- Preamble: "$ git ultrahope commit" + "✔ Found staged changes" ---

function CommandPreamble() {
	return (
		<>
			<div className="text-foreground">$ git ultrahope commit</div>
			<div className="text-emerald-400">✔ Found staged changes</div>
		</>
	);
}

// --- Compare: list mode, interactive ---

function CompareTerminal({
	toast,
}: {
	toast: { visible: boolean; show: () => void };
}) {
	const [selectedIndex, setSelectedIndex] = useState(2);
	const containerRef = useRef<HTMLDivElement>(null);

	const input = buildInput(COMPARE_SLOTS, selectedIndex, {
		edit: true,
		refine: true,
		escalate: true,
	});
	const { lines, slotIndices } = buildLines(input);

	const handleHover = useCallback((index: number) => {
		setSelectedIndex(index);
	}, []);

	const handleClick = useCallback(
		(index: number) => {
			setSelectedIndex(index);
			toast.show();
		},
		[toast],
	);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowUp" || e.key === "k") {
				e.preventDefault();
				setSelectedIndex((i) => Math.max(0, i - 1));
			} else if (e.key === "ArrowDown" || e.key === "j") {
				e.preventDefault();
				setSelectedIndex((i) => Math.min(COMPARE_SLOTS.length - 1, i + 1));
			} else if (e.key === "Enter") {
				e.preventDefault();
				toast.show();
			}
		};
		el.addEventListener("keydown", onKeyDown);
		return () => el.removeEventListener("keydown", onKeyDown);
	}, [toast]);

	return (
		// biome-ignore lint/a11y/noNoninteractiveTabindex: container needs focus for keyboard navigation
		<div ref={containerRef} tabIndex={0} className="outline-none">
			<CommandPreamble />
			<div className="mt-1 text-sm text-foreground-secondary leading-relaxed">
				<SelectorFrame
					lines={lines}
					slotIndices={slotIndices}
					onHover={handleHover}
					onClick={handleClick}
					interactive
				/>
			</div>
		</div>
	);
}

// --- Edit: prompt mode (edit), target slot is editable <input> ---

function EditTerminal({
	toast,
}: {
	toast: { visible: boolean; show: () => void };
}) {
	const [editText, setEditText] = useState(
		"fix(api): add missing timestamp to stream events",
	);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				toast.show();
			}
		},
		[toast],
	);

	const input = buildInput(
		COMPARE_SLOTS,
		2,
		{ refine: true, escalate: true },
		{
			mode: "prompt",
			promptKind: "edit",
			promptTargetIndex: 2,
		},
	);
	const { lines, slotIndices } = buildLines(input);

	return (
		<div>
			<CommandPreamble />
			<div className="mt-1 text-sm text-foreground-secondary leading-relaxed">
				<SelectorFrame
					lines={lines}
					slotIndices={slotIndices}
					editableSlot={{
						value: editText,
						onChange: setEditText,
						onKeyDown: handleKeyDown,
						inputRef,
					}}
				/>
			</div>
		</div>
	);
}

// --- Refine: prompt mode (refine), prompt input is editable ---

function RefineTerminal({
	toast,
}: {
	toast: { visible: boolean; show: () => void };
}) {
	const [refineText, setRefineText] = useState(
		"be more specific about what timestamp field was added",
	);
	const [selectedIndex, setSelectedIndex] = useState(1);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const input = buildInput(
		REFINE_SLOTS,
		selectedIndex,
		{ edit: true, escalate: true },
		{
			mode: "prompt",
			promptKind: "refine",
			promptTargetIndex: selectedIndex,
		},
	);
	const { lines, slotIndices } = buildLines(input);

	const handleHover = useCallback((index: number) => {
		setSelectedIndex(index);
	}, []);

	return (
		<div>
			<CommandPreamble />
			<div className="mt-1 text-sm text-foreground-secondary leading-relaxed">
				<SelectorFrame
					lines={lines}
					slotIndices={slotIndices}
					onHover={handleHover}
					onClick={handleHover}
					interactive
					editablePrompt={{
						value: refineText,
						onChange: setRefineText,
						onKeyDown: (e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								toast.show();
							}
						},
						inputRef,
					}}
				/>
			</div>
		</div>
	);
}

// --- Escalate: previous generation (done) + escalated generation (running) ---

function EscalateTerminal() {
	const prevInput = buildInput(COMPARE_SLOTS, 2, {
		edit: true,
		refine: true,
		escalate: true,
	});
	const prevFrame = selectorRenderFrame(prevInput);
	const prevCostSuffix = prevFrame.viewModel.header.totalCostLabel
		? ` (total: ${prevFrame.viewModel.header.totalCostLabel})`
		: "";
	const prevGeneratedLine = `${prevFrame.viewModel.header.generatedLabel}${prevCostSuffix}`;

	const escalateInput = buildInput(
		ESCALATE_SLOTS,
		0,
		{ edit: true, refine: true, escalate: true },
		{ isGenerating: true, totalSlots: 4 },
	);
	const { lines: escalateLines, slotIndices } = buildLines(escalateInput);

	return (
		<div>
			<CommandPreamble />
			<div className="mt-1 text-sm text-foreground-secondary leading-relaxed">
				<div>
					<span className="text-emerald-400">✔</span>{" "}
					<span className="text-foreground">{prevGeneratedLine}</span>
				</div>
				<div className="text-foreground-muted/60 pl-4">→ Escalate</div>
				<SelectorFrame lines={escalateLines} slotIndices={slotIndices} />
			</div>
		</div>
	);
}

export function MarketingControlLoopSection() {
	const [activeStepId, setActiveStepId] = useState<ControlStepId>("compare");
	const activeTabId = `control-loop-tab-${activeStepId}`;
	const toast = useDemoToast();

	let terminalContent: ReactNode;
	switch (activeStepId) {
		case "compare":
			terminalContent = <CompareTerminal toast={toast} />;
			break;
		case "edit":
			terminalContent = <EditTerminal toast={toast} />;
			break;
		case "refine":
			terminalContent = <RefineTerminal toast={toast} />;
			break;
		case "escalate":
			terminalContent = <EscalateTerminal />;
			break;
	}

	return (
		<section>
			<div className="py-16 lg:py-20 flex flex-col items-center gap-12 lg:gap-14">
				<div className="w-full max-w-4xl text-center">
					<h2 className="text-2xl font-medium font-serif sm:text-3xl">
						What if the result isn&apos;t quite right?
					</h2>
					<p className="mt-4 text-base text-foreground-secondary sm:text-lg">
						You stay in control. The model just gets you started.
					</p>
				</div>

				<div className="w-full max-w-6xl">
					<div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10 lg:items-center">
						<div
							role="tablist"
							aria-orientation="vertical"
							className="space-y-8"
						>
							{CONTROL_STEPS.map((step) => {
								const isActive = step.id === activeStepId;
								const tabId = `control-loop-tab-${step.id}`;
								return (
									<button
										key={step.id}
										type="button"
										role="tab"
										id={tabId}
										aria-selected={isActive}
										aria-controls="control-loop-panel"
										tabIndex={isActive ? 0 : -1}
										onClick={() => setActiveStepId(step.id)}
										className={`w-full border-l-2 pl-5 text-left transition-colors ${
											isActive
												? "border-l-foreground-secondary text-foreground"
												: "border-l-transparent text-foreground-muted hover:text-foreground-secondary"
										}`}
									>
										<p className="text-lg leading-tight font-medium">
											{step.title}
										</p>
										<p className="mt-1.5 text-sm leading-[1.45] whitespace-pre-line text-foreground-muted sm:text-base">
											{step.description}
										</p>
									</button>
								);
							})}
						</div>

						<TerminalWindow title="ultrahope" className="font-mono">
							<div
								id="control-loop-panel"
								role="tabpanel"
								aria-labelledby={activeTabId}
								className="relative h-100 overflow-auto px-5 py-5 sm:px-6 sm:py-6"
							>
								{terminalContent}
								<DemoToast visible={toast.visible} />
							</div>
						</TerminalWindow>
					</div>
				</div>

				<p className="text-center font-mono text-base text-foreground-secondary sm:text-lg">
					The model drafts. You have the final word.
				</p>
			</div>
		</section>
	);
}
