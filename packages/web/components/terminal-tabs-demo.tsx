"use client";

import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import commitMessageStreamCapture from "@/lib/demo/commit-message-stream.capture.json";
import {
	type CandidateWithModel,
	type CreateCandidates,
	createTerminalSelectorController,
	renderSelectorLines,
	type SelectorResult,
	type SelectorState,
	SPINNER_FRAMES,
	type TerminalSelectorController,
} from "@/lib/util/terminal-selector";
import { createCandidatesFromTasks } from "@/lib/util/terminal-selector-effect";
import {
	createCandidatesFromReplayGeneration,
	extractReplayModels,
	pickLatestReplayGeneration,
	pickLatestReplayRun,
} from "@/lib/util/terminal-selector-replay";
import { formatCost } from "../../shared/terminal-selector-helpers";
import {
	buildSelectorViewModel,
	type SelectorSlotViewModel,
} from "../../shared/terminal-selector-view-model";
import type {
	TerminalStreamReplayCapture,
	TerminalStreamReplayGeneration,
} from "../../shared/terminal-stream-replay";
import { TerminalWindow } from "./terminal-window";

interface DemoTab {
	id: string;
	label: string;
	command: string;
	diff: string;
	fallbacks: string[];
	foundLine: string;
	runLine: string;
	applyLine: string;
	models: string[];
	replayGeneration?: TerminalStreamReplayGeneration | null;
}

const DEFAULT_REPLAY_MODELS = ["mock-0", "mock-1", "mock-2"];

function resolveReplay(capture: TerminalStreamReplayCapture): {
	generation: TerminalStreamReplayGeneration | null;
	models: string[];
} {
	const run = pickLatestReplayRun(capture);
	const generation = run ? pickLatestReplayGeneration(run) : null;
	const models = generation ? extractReplayModels(generation) : [];

	return {
		generation,
		models: models.length > 0 ? models : DEFAULT_REPLAY_MODELS,
	};
}

const SHARED_REPLAY = resolveReplay(
	commitMessageStreamCapture as TerminalStreamReplayCapture,
);
// Refresh shared fixture with: ultrahope jj describe --capture-stream packages/web/lib/demo/commit-message-stream.capture.json

const DEMO_TABS: DemoTab[] = [
	{
		id: "git-commit",
		label: "git commit",
		command: "git ultrahope commit",
		diff: `diff --git a/packages/cli/commands/commit.ts b/packages/cli/commands/commit.ts
index 9c9e8f7..6d2f8a1 100644
--- a/packages/cli/commands/commit.ts
+++ b/packages/cli/commands/commit.ts
@@ -24,7 +24,7 @@
   const args = parseArgs(process.argv);
 -  await runCommitMessage("mistral/ministral-3b");
 +  await runCommitMessage(["mistral/ministral-3b", "xai/grok-code-fast-1"]);

 export async function runCommitMessage(models: string[]) {
 `,
		fallbacks: [
			"feat(cli): improve commit message generation UX",
			"refactor(cli): simplify commit message candidate flow",
			"fix(cli): handle empty staged diff safely",
		],
		foundLine: "✔ Found staged changes",
		runLine: "Generating commit messages",
		applyLine: "✔ Running git commit",
		models: SHARED_REPLAY.models,
		replayGeneration: SHARED_REPLAY.generation,
	},
	{
		id: "jj-describe",
		label: "jj describe",
		command: "ultrahope jj describe",
		diff: `diff --git a/packages/cli/commands/jj.ts b/packages/cli/commands/jj.ts
index 4f8d4e1..7b3c8a2 100644
--- a/packages/cli/commands/jj.ts
+++ b/packages/cli/commands/jj.ts
@@ -12,7 +12,8 @@
 export async function runJjDescribe(input: string) {
 -  return generateCommitMessages(input, { command: "jj describe" });
 +  const output = await formatDescribeInput(input);
 +  return generateCommitMessages(output, { command: "jj describe" });
 }`,
		fallbacks: [
			"feat(jj): improve describe prompt quality for revisions",
			"refactor(jj): align describe output with commit style",
			"fix(jj): preserve existing description when canceled",
		],
		foundLine: "✔ Found current revision diff",
		runLine: "Generating description candidates",
		applyLine: "✔ Running jj describe -r @",
		models: SHARED_REPLAY.models,
		replayGeneration: SHARED_REPLAY.generation,
	},
	{
		id: "unix-style",
		label: "unix style",
		command:
			"git diff --staged | ultrahope translate --target vcs-commit-message",
		diff: `diff --git a/packages/web/components/terminal-tabs-demo.tsx b/packages/web/components/terminal-tabs-demo.tsx
index a1b2c3d..d4e5f6g 100644
--- a/packages/web/components/terminal-tabs-demo.tsx
+++ b/packages/web/components/terminal-tabs-demo.tsx
@@ -42,7 +42,8 @@
 export default function TerminalDemo() {
 -  const text = "feat: initial implementation";
 +  const text = "feat: add commit message translation flow";
 +  return text;
 }`,
		fallbacks: [
			"feat(api): normalize commit message translation output",
			"refactor(core): improve stdin to message conversion",
			"fix(cli): support multiline diff translation input",
		],
		foundLine: "✔ Reading input from stdin",
		runLine: "Generating commit message translations",
		applyLine: "✔ Copying selected message to output",
		models: SHARED_REPLAY.models,
		replayGeneration: SHARED_REPLAY.generation,
	},
];

type DemoPhase =
	| "initial"
	| "typing"
	| "waitingEnter"
	| "selector"
	| "selected";

const SPINNER_FRAME_SET = new Set(SPINNER_FRAMES);

function useTypingAnimation(
	command: string,
	enabled: boolean,
	speedMs = 18,
): string {
	const [typedText, setTypedText] = useState("");

	useEffect(() => {
		if (enabled) {
			setTypedText("");
		}
	}, [enabled]);

	useEffect(() => {
		if (!enabled) return;
		if (typedText.length >= command.length) {
			return;
		}
		const timer = setTimeout(() => {
			setTypedText(command.slice(0, typedText.length + 1));
		}, speedMs);
		return () => clearTimeout(timer);
	}, [typedText, command, enabled, speedMs]);

	return typedText;
}

function renderSelectorLinesWithSpinner(
	lines: string[],
	showSpinner: boolean,
	spinnerCharacter: string,
): ReactNode[] {
	const nodes: ReactNode[] = [];
	const lineCounts = new Map<string, number>();
	let lineIndex = 0;

	for (const line of lines) {
		const count = (lineCounts.get(line) ?? 0) + 1;
		lineCounts.set(line, count);
		const key = `${line}-${count}`;

		if (!showSpinner || lineIndex !== 0) {
			nodes.push(
				<span key={key}>
					{line}
					{"\n"}
				</span>,
			);
			lineIndex += 1;
			continue;
		}

		const firstCharacter = line.slice(0, 1);
		if (!SPINNER_FRAME_SET.has(firstCharacter)) {
			nodes.push(
				<span key={key}>
					{line}
					{"\n"}
				</span>,
			);
			lineIndex += 1;
			continue;
		}

		nodes.push(
			<span key={key}>
				{spinnerCharacter}
				{line.slice(1)}
				{"\n"}
			</span>,
		);
		lineIndex += 1;
	}

	return nodes;
}

function renderSlotLines(slot: SelectorSlotViewModel): string[] {
	const lines = [`${slot.radio} ${slot.title}`];
	if (slot.meta) {
		lines.push(`   ${slot.meta}`);
	}
	return lines;
}

function isInteractiveKeyTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	return Boolean(
		target.closest(
			'button, [role="button"], [role="tab"], a[href], input, textarea, select, summary, [contenteditable], [tabindex]:not([tabindex="-1"])',
		),
	);
}

function createCandidatesFromDirectCore(options: {
	diff: string;
	models: string[];
	fallbacks: string[];
}): CreateCandidates {
	return createCandidatesFromTasks({
		tasks: options.models.map((model, index) => ({
			slotId: `slot-${index}`,
			slotIndex: index,
			model,
			run: (signal) =>
				activateCandidateTask(
					model,
					index,
					{
						diff: options.diff,
						fallback: options.fallbacks[index],
					},
					signal,
				),
		})),
	});
}

async function activateCandidateTask(
	model: string,
	index: number,
	opts: { diff: string; fallback?: string },
	signal: AbortSignal,
): Promise<CandidateWithModel> {
	const slotId = `slot-${index}`;
	try {
		return makeMockCandidate({
			slotId,
			slotIndex: index,
			model,
			fallback: opts.fallback,
			signal,
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw error;
		}
		return {
			slotId,
			content:
				opts.fallback ??
				"feat: generate a concise commit message for staged changes",
			slotIndex: index,
			model,
		};
	}
}

async function makeMockCandidate({
	slotId,
	slotIndex,
	model,
	fallback,
	signal,
}: {
	slotId: string;
	slotIndex: number;
	model: string;
	fallback?: string;
	signal: AbortSignal;
}): Promise<CandidateWithModel> {
	const fallbackText =
		fallback ?? "feat: generate a concise commit message for staged changes";
	const delayMs = 120 + (slotIndex % 3) * 120;

	if (signal.aborted) {
		throw new DOMException("Operation cancelled", "AbortError");
	}

	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, delayMs + Math.floor(Math.random() * 80));
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				reject(new DOMException("Operation cancelled", "AbortError"));
			},
			{ once: true },
		);
	});

	if (signal.aborted) {
		throw new DOMException("Operation cancelled", "AbortError");
	}

	return {
		slotId,
		slotIndex,
		model,
		content: fallbackText,
		cost: 0,
		generationMs: delayMs,
		generationId: `${model}-${slotId}`,
	};
}

function createCandidatesForDemo(tab: DemoTab): CreateCandidates {
	if (tab.replayGeneration && tab.replayGeneration.events.length > 0) {
		return createCandidatesFromReplayGeneration({
			generation: tab.replayGeneration,
			models: tab.models,
		});
	}

	return createCandidatesFromDirectCore({
		diff: tab.diff,
		models: tab.models,
		fallbacks: tab.fallbacks,
	});
}

export function TerminalTabsDemo() {
	const [activeTab, setActiveTab] = useState(DEMO_TABS[0].id);
	const activeDemo =
		DEMO_TABS.find((tab) => tab.id === activeTab) ?? DEMO_TABS[0];
	const [canAutoRun, setCanAutoRun] = useState(false);
	const [phase, setPhase] = useState<DemoPhase>("initial");
	const typedText = useTypingAnimation(activeDemo.command, phase === "typing");
	const [selectorState, setSelectorState] = useState<SelectorState | null>(
		null,
	);
	const [selectedResult, setSelectedResult] = useState<SelectorResult | null>(
		null,
	);
	const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
	const selectorControllerRef = useRef<TerminalSelectorController | null>(null);

	const destroySelector = useCallback(() => {
		selectorControllerRef.current?.destroy();
		selectorControllerRef.current = null;
		setSelectorState(null);
		setSelectedResult(null);
	}, []);

	const startSelector = useCallback(() => {
		destroySelector();
		const candidates = createCandidatesForDemo(activeDemo);

		const controller = createTerminalSelectorController({
			maxSlots: Math.max(1, activeDemo.models.length),
			models: activeDemo.models,
			createCandidates: candidates,
			onState: setSelectorState,
		});

		selectorControllerRef.current = controller;
		setSelectedResult(null);
		setSpinnerFrameIndex(0);
		setPhase("selector");
		controller.start();
	}, [activeDemo, destroySelector]);

	useEffect(() => {
		if (activeTab) {
			setPhase("initial");
			destroySelector();
		}
	}, [activeTab, destroySelector]);

	useEffect(() => {
		return () => {
			destroySelector();
		};
	}, [destroySelector]);

	const handleReplay = useCallback(() => {
		setPhase("initial");
	}, []);

	useEffect(() => {
		if (canAutoRun) return;
		const enableAutoRun = () => setCanAutoRun(true);
		const listenerOptions = { passive: true, once: true };
		const timer = setTimeout(enableAutoRun, 5000);
		window.addEventListener("scroll", enableAutoRun, listenerOptions);
		window.addEventListener("mousemove", enableAutoRun, listenerOptions);
		return () => {
			clearTimeout(timer);
			window.removeEventListener("scroll", enableAutoRun);
			window.removeEventListener("mousemove", enableAutoRun);
		};
	}, [canAutoRun]);

	useEffect(() => {
		if (phase !== "initial") return;
		const timer = setTimeout(() => setPhase("typing"), 220);
		return () => clearTimeout(timer);
	}, [phase]);

	useEffect(() => {
		if (phase !== "typing") return;
		if (typedText.length >= activeDemo.command.length) {
			if (!canAutoRun) return;
			const timer = setTimeout(() => {
				startSelector();
			}, 1000);
			return () => clearTimeout(timer);
		}
	}, [activeDemo.command, canAutoRun, phase, startSelector, typedText]);

	const onResult = useCallback(
		(result: SelectorResult) => {
			if (result.action === "confirm") {
				setSelectedResult(result);
				setPhase("selected");
				return;
			}
			if (result.action === "reroll") {
				startSelector();
				return;
			}
			if (result.action === "abort") {
				setPhase("waitingEnter");
			}
		},
		[startSelector],
	);

	const handleCandidateHover = useCallback(
		(index: number) => {
			if (phase !== "selector") return;
			selectorControllerRef.current?.setSelection(index);
		},
		[phase],
	);

	const handleCandidateClick = useCallback(
		(index: number) => {
			if (phase !== "selector") return;
			selectorControllerRef.current?.setSelection(index);
			const result = selectorControllerRef.current?.confirm();
			if (result?.action === "confirm") {
				onResult(result);
			}
		},
		[onResult, phase],
	);

	useEffect(() => {
		if (!selectorState?.isGenerating) return;
		const timer = setInterval(() => {
			setSpinnerFrameIndex((index) => (index + 1) % SPINNER_FRAMES.length);
		}, 80);
		return () => clearInterval(timer);
	}, [selectorState?.isGenerating]);

	const onKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey) {
				return;
			}

			if (
				phase === "waitingEnter" &&
				event.key === "Enter" &&
				!isInteractiveKeyTarget(event.target)
			) {
				event.preventDefault();
				startSelector();
				return;
			}

			if (phase !== "selector" && phase !== "selected") return;
			if (isInteractiveKeyTarget(event.target)) return;

			const result = selectorControllerRef.current?.handleKey({
				key: event.key,
				ctrlKey: event.ctrlKey,
			});
			if (!result) return;
			event.preventDefault();
			onResult(result);
		},
		[phase, onResult, startSelector],
	);

	useEffect(() => {
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onKeyDown]);

	const selectorCopy = {
		runningLabel: `${activeDemo.runLine}...`,
		selectionLabel: "Select a candidate",
	};
	const selectorCapabilities = {
		clickConfirm: true,
	};
	const selectorViewModel =
		selectorState !== null
			? buildSelectorViewModel({
					state: selectorState,
					nowMs: 0,
					spinnerFrames: SPINNER_FRAMES,
					copy: selectorCopy,
					capabilities: selectorCapabilities,
				})
			: null;
	const renderedSelectorLines =
		selectorState !== null
			? renderSelectorLines(selectorState, 0, {
					copy: selectorCopy,
					capabilities: selectorCapabilities,
				})
			: [];
	const renderedSelectorHeaderLines =
		selectorState !== null
			? renderSelectorLinesWithSpinner(
					renderedSelectorLines,
					selectorState.isGenerating,
					SPINNER_FRAMES[spinnerFrameIndex],
				)
			: [];
	const panelId = "terminal-demo-panel";
	const activeTabId = `terminal-demo-tab-${activeDemo.id}`;

	return (
		<div className="space-y-3">
			<TerminalWindow title="ultrahope demo" className="font-mono">
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
					className="h-120 overflow-auto px-4 py-4 text-sm text-foreground-secondary leading-relaxed"
				>
					<div className="flex items-start gap-2">
						<span className="text-foreground shrink-0">$</span>
						<code className="text-foreground whitespace-pre-wrap break-all">
							{typedText}
						</code>
						{(phase === "initial" ||
							phase === "typing" ||
							phase === "waitingEnter") && (
							<span className="flex items-center gap-2 animate-pulse">
								<span className="mt-0.5 h-4 w-2 bg-foreground/90" />
							</span>
						)}
					</div>

					{(phase === "selector" || phase === "selected") &&
						selectorState &&
						selectorViewModel && (
							<div className="mt-2 text-sm">
								<p className="text-green-400">{activeDemo.foundLine}</p>
								{renderedSelectorHeaderLines.length > 0 && (
									<pre className="mt-2 whitespace-pre-wrap text-foreground-secondary">
										{renderedSelectorHeaderLines[0]}
										{renderedSelectorHeaderLines[1]}
									</pre>
								)}
								<div className="mt-2 space-y-1">
									{selectorViewModel.slots.map((slot, index) => {
										const sourceSlot = selectorState.slots[index];
										const isSelected = slot.selected;
										const isReady = slot.status === "ready";
										const isInteractive = phase === "selector" && isReady;
										const lines = renderSlotLines(slot);
										const slotKey =
											sourceSlot?.status === "ready"
												? sourceSlot.candidate.slotId
												: sourceSlot?.slotId;

										if (!isInteractive) {
											return (
												<div
													key={slotKey ?? `slot-${index}`}
													className="rounded px-2 py-1 text-left font-mono text-foreground-muted/60"
												>
													<span className="block">{lines[0]}</span>
													{lines[1] && (
														<span className="mt-0.5 block pl-3 text-foreground-muted/80">
															{lines[1]}
														</span>
													)}
												</div>
											);
										}

										return (
											<button
												key={slotKey ?? `slot-${index}`}
												type="button"
												onMouseEnter={() => handleCandidateHover(index)}
												onClick={() => handleCandidateClick(index)}
												className={`w-full rounded px-2 py-1 text-left font-mono ${
													isSelected
														? "bg-surface-hover text-foreground"
														: "text-foreground-secondary hover:bg-surface-hover hover:text-foreground"
												}`}
											>
												<span className="flex items-start justify-between gap-3">
													<span className="block">{lines[0]}</span>
													{isSelected && (
														<span className="shrink-0 text-[11px] text-foreground-muted/80">
															Enter to confirm / Click to confirm
														</span>
													)}
												</span>
												{lines[1] && (
													<span className="mt-0.5 block pl-3 text-foreground-muted">
														{lines[1]}
													</span>
												)}
											</button>
										);
									})}
								</div>
							</div>
						)}

					{phase === "selected" && selectedResult?.selected && (
						<div className="mt-4">
							<p className="text-green-400">✔ Candidate selected</p>
							<p className="text-green-400">{activeDemo.applyLine}</p>
							<p className="mt-1 text-foreground-muted">
								{selectedResult.selected}
							</p>
							{selectedResult.selectedCandidate?.cost != null && (
								<p className="text-foreground-muted/80">
									Cost: {formatCost(selectedResult.selectedCandidate.cost)}
								</p>
							)}
							<button
								type="button"
								onClick={handleReplay}
								className="mt-4 inline-flex rounded border border-border-subtle bg-surface/70 px-3 py-1.5 text-foreground transition hover:border-foreground-muted hover:text-foreground"
							>
								Replay from start
							</button>
						</div>
					)}
				</div>
			</TerminalWindow>
		</div>
	);
}
