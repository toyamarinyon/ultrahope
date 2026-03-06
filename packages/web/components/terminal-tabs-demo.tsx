"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import commitMessageStreamCapture from "@/lib/demo/commit-message-stream.capture.json";
import {
	type CandidateWithModel,
	type CreateCandidates,
	createTerminalSelectorController,
	type SelectorResult,
	type SelectorState,
	SPINNER_FRAMES,
	selectorRenderFrame,
	type TerminalSelectorController,
} from "@/lib/util/terminal-selector";
import { createCandidatesFromTasks } from "@/lib/util/terminal-selector-effect";
import {
	createCandidatesFromReplayGeneration,
	extractReplayModels,
	pickLatestReplayGeneration,
	pickLatestReplayRun,
} from "@/lib/util/terminal-selector-replay";
import { normalizeCandidateContentForDisplay } from "../../shared/terminal-selector-helpers";
import {
	buildSelectorRenderLines,
	type SelectorRenderLine,
} from "../../shared/terminal-selector-view-model";
import type {
	TerminalStreamReplayCapture,
	TerminalStreamReplayGeneration,
} from "../../shared/terminal-stream-replay";
import { SelectorFrame, SuccessLine } from "./selector-frame";
import { TerminalWindow } from "./terminal-window";

interface DemoTab {
	id: string;
	label: string;
	command: string;
	diff: string;
	fallbacks: string[];
	foundLine: string;
	runLine: string;
	confirmOutput:
		| { kind: "gitCommit" }
		| { kind: "jjDescribe"; revision: string }
		| { kind: "translate" };
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
		confirmOutput: { kind: "gitCommit" },
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
		confirmOutput: { kind: "jjDescribe", revision: "@" },
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
		confirmOutput: { kind: "translate" },
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

function buildSlotIndices(lines: SelectorRenderLine[]): Map<number, number> {
	const slotIndices = new Map<number, number>();
	let slotCount = 0;
	let currentSlotIndex: number | undefined;
	for (const [lineIndex, line] of lines.entries()) {
		if (line.type === "slot") {
			currentSlotIndex = slotCount;
			slotIndices.set(lineIndex, currentSlotIndex);
			slotCount += 1;
			continue;
		}
		if (line.type === "slotMeta" && currentSlotIndex != null) {
			slotIndices.set(lineIndex, currentSlotIndex);
			continue;
		}
		currentSlotIndex = undefined;
	}
	return slotIndices;
}

type DemoOutputLine =
	| { kind: "success"; text: string }
	| { kind: "plain"; text: string };

function formatSelectedOutputLine(
	tab: DemoTab,
	selected: string,
): DemoOutputLine {
	switch (tab.confirmOutput.kind) {
		case "gitCommit":
			return {
				kind: "success",
				text: `git commit -m ${JSON.stringify(selected)}`,
			};
		case "jjDescribe":
			return {
				kind: "success",
				text: `jj describe -r ${tab.confirmOutput.revision} -m ${JSON.stringify(selected)}`,
			};
		case "translate":
			return {
				kind: "plain",
				text: selected,
			};
	}
}

function buildSelectedPhaseLines(input: {
	tab: DemoTab;
	result: SelectorResult;
	generatedLabel: string;
	totalCostLabel?: string;
}): DemoOutputLine[] {
	const selected = input.result.selected ?? "";
	const selectedTitle =
		normalizeCandidateContentForDisplay(selected) || selected;
	const costSuffix = input.totalCostLabel
		? ` (total: ${input.totalCostLabel})`
		: "";
	const lines: DemoOutputLine[] = [
		{
			kind: "success",
			text: `${input.generatedLabel}${costSuffix}`,
		},
	];

	if (selectedTitle) {
		lines.push({
			kind: "success",
			text: `Selected: ${selectedTitle}`,
		});
	}

	lines.push(formatSelectedOutputLine(input.tab, selected));
	return lines;
}

function stripSuccessPrefix(text: string): string {
	return text.startsWith("✔ ") ? text.slice(2) : text;
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
		destroySelector();
		setPhase("initial");
	}, [destroySelector]);

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

	const onResult = useCallback((result: SelectorResult) => {
		if (result.action === "confirm") {
			setSelectedResult(result);
			setPhase("selected");
			return;
		}
		if (result.action === "abort") {
			setPhase("waitingEnter");
		}
	}, []);

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

			if (phase !== "selector") return;
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
		selectionLabel: "Select a commit message",
		itemLabelSingular: "commit message",
		itemLabelPlural: "commit messages",
	};
	const selectorCapabilities = {
		clickConfirm: false,
		edit: true,
		refine: true,
		escalate: true,
	};
	const selectorFrame =
		selectorState !== null
			? selectorRenderFrame({
					state: selectorState,
					nowMs: spinnerFrameIndex * 80,
					spinnerFrames: SPINNER_FRAMES,
					copy: selectorCopy,
					capabilities: selectorCapabilities,
				})
			: null;
	const selectorLines =
		selectorFrame !== null ? buildSelectorRenderLines(selectorFrame) : [];
	const selectorSlotIndices = buildSlotIndices(selectorLines);
	const selectedPhaseLines =
		selectorFrame !== null && selectedResult?.selected
			? buildSelectedPhaseLines({
					tab: activeDemo,
					result: selectedResult,
					generatedLabel: selectorFrame.viewModel.header.generatedLabel,
					totalCostLabel: selectorFrame.viewModel.header.totalCostLabel,
				})
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

					{phase === "selector" && selectorState && selectorFrame && (
						<div className="text-sm leading-relaxed">
							<SuccessLine text={stripSuccessPrefix(activeDemo.foundLine)} />
							<div className="text-foreground-secondary">
								<SelectorFrame
									lines={selectorLines}
									slotIndices={selectorSlotIndices}
									onHover={handleCandidateHover}
									onClick={handleCandidateClick}
									interactive
								/>
							</div>
						</div>
					)}

					{phase === "selected" && selectedResult?.selected && (
						<div className="text-sm leading-relaxed">
							<SuccessLine text={stripSuccessPrefix(activeDemo.foundLine)} />
							<div>
								{selectedPhaseLines.map((line, index) =>
									line.kind === "success" ? (
										<SuccessLine
											key={`${line.text}-${index}`}
											text={line.text}
										/>
									) : (
										<p
											key={`${line.text}-${index}`}
											className="text-foreground"
										>
											{line.text}
										</p>
									),
								)}
							</div>
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
