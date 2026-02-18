"use client";

import { useCallback, useEffect, useReducer, useState } from "react";

type DemoTab = {
	id: string;
	label: string;
	command: string;
	foundLine: string;
	runLine: string;
	options: string[];
	applyLine: string;
};

const DEMO_TABS: DemoTab[] = [
	{
		id: "git-commit",
		label: "git commit",
		command: "git ultrahope commit",
		foundLine: "✔ Found staged changes",
		runLine: "Generating commit messages",
		options: [
			"feat(cli): improve commit message generation UX",
			"refactor(cli): simplify commit message candidate flow",
			"fix(cli): handle empty staged diff safely",
		],
		applyLine: "✔ Running git commit",
	},
	{
		id: "jj-describe",
		label: "jj describe",
		command: "ultrahope jj describe",
		foundLine: "✔ Found current revision diff",
		runLine: "Generating description candidates",
		options: [
			"feat(jj): improve describe prompt quality for revisions",
			"refactor(jj): align describe output with commit style",
			"fix(jj): preserve existing description when canceled",
		],
		applyLine: "✔ Running jj describe -r @",
	},
	{
		id: "unix-style",
		label: "unix style",
		command:
			"git diff --staged | ultrahope translate --target vcs-commit-message",
		foundLine: "✔ Reading input from stdin",
		runLine: "Generating commit message translations",
		options: [
			"feat(api): normalize commit message translation output",
			"refactor(core): improve stdin to message conversion",
			"fix(cli): support multiline diff translation input",
		],
		applyLine: "✔ Copying selected message to output",
	},
];

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

type Slot = { status: "pending" } | { status: "ready"; content: string };
type Phase =
	| "initial"
	| "typing"
	| "waitingEnter"
	| "analyzing"
	| "generating"
	| "selector"
	| "selected";

type DemoState = {
	phase: Phase;
	typedText: string;
	spinnerFrame: number;
	generatedCount: number;
	selectedIndex: number;
	slots: Slot[];
};

type DemoAction =
	| { type: "RESET_FOR_TAB" }
	| { type: "START_TYPING" }
	| { type: "TICK_TYPE"; nextText: string }
	| { type: "WAIT_FOR_ENTER" }
	| { type: "START_ANALYZING" }
	| { type: "START_GENERATING"; slotCount: number }
	| { type: "TICK_SPINNER" }
	| { type: "SLOT_READY"; index: number; content: string }
	| { type: "SHOW_SELECTOR" }
	| { type: "MOVE_SELECTION"; direction: -1 | 1; maxIndex: number }
	| { type: "SET_SELECTION"; index: number }
	| { type: "SELECT"; index?: number }
	| { type: "REROLL"; slotCount: number };

function createPendingSlots(count: number): Slot[] {
	return Array.from({ length: count }, () => ({ status: "pending" as const }));
}

function createInitialDemoState(): DemoState {
	return {
		phase: "initial",
		typedText: "",
		spinnerFrame: 0,
		generatedCount: 0,
		selectedIndex: 0,
		slots: [],
	};
}

function demoReducer(state: DemoState, action: DemoAction): DemoState {
	switch (action.type) {
		case "RESET_FOR_TAB":
			return createInitialDemoState();
		case "START_TYPING":
			return { ...state, phase: "typing" };
		case "TICK_TYPE":
			return { ...state, typedText: action.nextText };
		case "WAIT_FOR_ENTER":
			return { ...state, phase: "waitingEnter" };
		case "START_ANALYZING":
			return { ...state, phase: "analyzing" };
		case "START_GENERATING":
			return {
				...state,
				phase: "generating",
				generatedCount: 0,
				selectedIndex: 0,
				slots: createPendingSlots(action.slotCount),
			};
		case "TICK_SPINNER":
			return {
				...state,
				spinnerFrame: (state.spinnerFrame + 1) % SPINNER_FRAMES.length,
			};
		case "SLOT_READY": {
			const nextSlots = [...state.slots];
			nextSlots[action.index] = { status: "ready", content: action.content };
			return {
				...state,
				slots: nextSlots,
				generatedCount: Math.max(state.generatedCount, action.index + 1),
			};
		}
		case "SHOW_SELECTOR":
			return { ...state, phase: "selector" };
		case "MOVE_SELECTION":
			return {
				...state,
				selectedIndex: Math.max(
					0,
					Math.min(action.maxIndex, state.selectedIndex + action.direction),
				),
			};
		case "SET_SELECTION":
			return { ...state, selectedIndex: action.index };
		case "SELECT":
			return {
				...state,
				phase: "selected",
				selectedIndex: action.index ?? state.selectedIndex,
			};
		case "REROLL":
			return {
				...state,
				phase: "generating",
				generatedCount: 0,
				selectedIndex: 0,
				slots: createPendingSlots(action.slotCount),
			};
	}
}

function isInteractiveKeyTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	return Boolean(
		target.closest(
			'button, [role="button"], [role="tab"], a[href], input, textarea, select, summary, [contenteditable], [tabindex]:not([tabindex="-1"])',
		),
	);
}

export function TerminalTabsDemo() {
	const [activeTab, setActiveTab] = useState(DEMO_TABS[0].id);
	const activeDemo =
		DEMO_TABS.find((tab) => tab.id === activeTab) ?? DEMO_TABS[0];
	const [state, dispatch] = useReducer(
		demoReducer,
		undefined,
		createInitialDemoState,
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: activeDemo.id is intentionally used as a reset trigger when the active tab changes
	useEffect(() => {
		dispatch({ type: "RESET_FOR_TAB" });
	}, [activeDemo.id]);

	useEffect(() => {
		if (state.phase !== "initial") return;
		const timeout = setTimeout(() => dispatch({ type: "START_TYPING" }), 220);
		return () => clearTimeout(timeout);
	}, [state.phase]);

	useEffect(() => {
		if (state.phase !== "typing") return;
		if (state.typedText.length >= activeDemo.command.length) {
			const timeout = setTimeout(
				() => dispatch({ type: "WAIT_FOR_ENTER" }),
				180,
			);
			return () => clearTimeout(timeout);
		}
		const timeout = setTimeout(() => {
			dispatch({
				type: "TICK_TYPE",
				nextText: activeDemo.command.slice(0, state.typedText.length + 1),
			});
		}, 18);
		return () => clearTimeout(timeout);
	}, [state.phase, state.typedText, activeDemo.command]);

	useEffect(() => {
		if (state.phase !== "analyzing") return;
		const timeout = setTimeout(() => {
			dispatch({
				type: "START_GENERATING",
				slotCount: activeDemo.options.length,
			});
		}, 320);
		return () => clearTimeout(timeout);
	}, [state.phase, activeDemo.options.length]);

	useEffect(() => {
		if (state.phase !== "generating") return;
		const interval = setInterval(() => {
			dispatch({ type: "TICK_SPINNER" });
		}, 80);
		return () => clearInterval(interval);
	}, [state.phase]);

	useEffect(() => {
		if (state.phase !== "generating") return;
		if (state.generatedCount >= activeDemo.options.length) {
			const timeout = setTimeout(
				() => dispatch({ type: "SHOW_SELECTOR" }),
				120,
			);
			return () => clearTimeout(timeout);
		}
		const timeout = setTimeout(() => {
			dispatch({
				type: "SLOT_READY",
				index: state.generatedCount,
				content: activeDemo.options[state.generatedCount],
			});
		}, 180);
		return () => clearTimeout(timeout);
	}, [state.phase, state.generatedCount, activeDemo.options]);

	const reroll = useCallback(() => {
		dispatch({ type: "REROLL", slotCount: activeDemo.options.length });
	}, [activeDemo.options.length]);

	useEffect(() => {
		if (
			state.phase !== "waitingEnter" &&
			state.phase !== "selector" &&
			state.phase !== "selected"
		)
			return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (state.phase === "waitingEnter" && event.key === "Enter") {
				if (isInteractiveKeyTarget(event.target)) {
					return;
				}
				event.preventDefault();
				dispatch({ type: "START_ANALYZING" });
				return;
			}

			if (state.phase === "selector" || state.phase === "selected") {
				if (event.key === "r") {
					event.preventDefault();
					reroll();
					return;
				}
				if (state.phase === "selector") {
					if (event.key === "ArrowUp" || event.key === "k") {
						event.preventDefault();
						dispatch({
							type: "MOVE_SELECTION",
							direction: -1,
							maxIndex: activeDemo.options.length - 1,
						});
					} else if (event.key === "ArrowDown" || event.key === "j") {
						event.preventDefault();
						dispatch({
							type: "MOVE_SELECTION",
							direction: 1,
							maxIndex: activeDemo.options.length - 1,
						});
					} else if (event.key === "Enter") {
						event.preventDefault();
						dispatch({ type: "SELECT" });
					}
				}
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [state.phase, activeDemo.options.length, reroll]);

	const readyCount = state.slots.filter(
		(slot) => slot.status === "ready",
	).length;
	const selectedSlotAtIndex = state.slots[state.selectedIndex];
	const selectedSlot =
		selectedSlotAtIndex?.status === "ready" ? selectedSlotAtIndex : null;
	const panelId = "terminal-demo-panel";
	const activeTabId = `terminal-demo-tab-${activeDemo.id}`;

	return (
		<div className="rounded-xl border border-border-subtle bg-canvas-dark overflow-hidden font-mono">
			<div className="flex items-center justify-between border-b border-border-subtle bg-surface px-3 py-2">
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/60" />
					<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/40" />
					<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
				</div>
				<span className="text-[11px] text-foreground-secondary">
					ultrahope demo
				</span>
			</div>

			<div
				className="flex bg-surface/70"
				role="tablist"
				aria-label="Demo command scenarios"
			>
				{DEMO_TABS.map((tab) => {
					const isActive = tab.id === activeDemo.id;
					const tabId = `terminal-demo-tab-${tab.id}`;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							role="tab"
							id={tabId}
							aria-selected={isActive}
							aria-controls={panelId}
							tabIndex={isActive ? 0 : -1}
							className={`px-3 py-2 text-xs border-r border-border-subtle ${
								isActive
									? "bg-canvas-dark text-foreground"
									: "border-b border-border-subtle text-foreground-muted hover:text-foreground-secondary"
							}`}
						>
							{tab.label}
						</button>
					);
				})}
				<div
					aria-hidden="true"
					role="presentation"
					className="flex-1 border-b border-border-subtle"
				/>
			</div>

			<div
				id={panelId}
				role="tabpanel"
				aria-labelledby={activeTabId}
				className="h-72 overflow-auto px-4 py-4 text-sm text-foreground-secondary leading-relaxed"
			>
				<div className="flex items-start gap-2">
					<span className="text-foreground shrink-0">$</span>
					<code className="text-foreground whitespace-pre-wrap break-all">
						{state.typedText}
					</code>
					{(state.phase === "initial" ||
						state.phase === "typing" ||
						state.phase === "waitingEnter") && (
						<span className="flex items-center gap-2 animate-pulse">
							<span className="mt-0.5 h-4 w-2 bg-foreground/90" />
							<span
								className={`text-foreground-muted transition-opacity duration-400 ${
									state.phase === "waitingEnter" ? "opacity-100" : "opacity-0"
								}`}
							>
								Press enter to review proposals ↵
							</span>
						</span>
					)}
				</div>

				{(state.phase === "analyzing" ||
					state.phase === "generating" ||
					state.phase === "selector" ||
					state.phase === "selected") && (
					<p className="mt-3 text-green-400">{activeDemo.foundLine}</p>
				)}

				{state.phase === "generating" && (
					<p className="mt-2 text-yellow-400">
						{SPINNER_FRAMES[state.spinnerFrame]} {activeDemo.runLine}...{" "}
						{readyCount}/{activeDemo.options.length}
					</p>
				)}

				{(state.phase === "selector" || state.phase === "selected") && (
					<p className="mt-2">
						<span className="text-cyan-400">?</span>
						<span className="ml-2">
							Select a candidate (↑↓ navigate, enter confirm, r reroll)
						</span>
					</p>
				)}

				{(state.phase === "generating" ||
					state.phase === "selector" ||
					state.phase === "selected") && (
					<div className="mt-3 space-y-2">
						{state.slots.map((slot, index) => {
							if (slot.status === "pending") {
								return (
									<div key={`pending-${String(index)}`} className="opacity-50">
										○ Generating...
									</div>
								);
							}

							const isSelected = index === state.selectedIndex;
							return (
								<button
									key={`ready-${slot.content}`}
									type="button"
									onMouseEnter={() =>
										dispatch({ type: "SET_SELECTION", index })
									}
									onClick={() => {
										if (state.phase === "selector") {
											dispatch({ type: "SELECT", index });
										}
									}}
									className={`block w-full text-left ${
										isSelected ? "text-foreground" : "text-foreground-muted"
									}`}
								>
									{isSelected ? "●" : "○"} {slot.content}
								</button>
							);
						})}
					</div>
				)}

				{state.phase === "selected" && (
					<div className="mt-4">
						<p className="text-green-400">✔ Candidate selected</p>
						<p className="text-green-400">{activeDemo.applyLine}</p>
						<p className="mt-1 text-foreground-muted">
							{selectedSlot?.content}
						</p>
						<p className="mt-2 animate-pulse text-foreground-muted">
							press r to reroll
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
