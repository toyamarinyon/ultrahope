"use client";

import { RotateCcw } from "lucide-react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
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
import type { PromptKind } from "../../shared/terminal-selector-contract";
import { normalizeCandidateContentForDisplay } from "../../shared/terminal-selector-helpers";
import {
	buildSelectorRenderLines,
	type SelectorHintAction,
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
	defaultRefineInstruction: string;
	refinedFallbacks: string[];
	escalatedModels: string[];
	escalatedFallbacks: string[];
	models: string[];
	replayGeneration?: TerminalStreamReplayGeneration | null;
}

const DEFAULT_REPLAY_MODELS = ["mock-0", "mock-1", "mock-2"];
const ESCALATED_MODELS = [
	"anthropic/claude-sonnet-4.6",
	"openai/gpt-5.3-codex",
];

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
// Refresh shared fixture with: halo jj describe --capture-stream packages/web/lib/demo/commit-message-stream.capture.json

const DEMO_TABS: DemoTab[] = [
	{
		id: "git-commit",
		label: "git commit",
		command: "git halo commit",
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
		defaultRefineInstruction: "be more specific about the multi-model support",
		refinedFallbacks: [
			"feat(cli): support multi-model commit message generation",
			"refactor(cli): clarify multi-model candidate selection flow",
			"fix(cli): safely handle multi-model commit message generation",
		],
		escalatedModels: ESCALATED_MODELS,
		escalatedFallbacks: [
			"feat(cli): add multi-model commit message generation with clearer candidate selection",
			"refactor(cli): streamline commit message generation for parallel model runs",
		],
		models: SHARED_REPLAY.models,
		replayGeneration: SHARED_REPLAY.generation,
	},
	{
		id: "jj-describe",
		label: "jj describe",
		command: "halo jj describe",
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
		defaultRefineInstruction:
			"make it clearer that the input is formatted before generation",
		refinedFallbacks: [
			"feat(jj): format describe input before generating revision messages",
			"refactor(jj): make describe generation use formatted revision input",
			"fix(jj): preserve describe output while formatting input first",
		],
		escalatedModels: ESCALATED_MODELS,
		escalatedFallbacks: [
			"feat(jj): format revision input before generating describe candidates",
			"refactor(jj): route describe generation through normalized revision formatting",
		],
		models: SHARED_REPLAY.models,
		replayGeneration: SHARED_REPLAY.generation,
	},
	{
		id: "unix-style",
		label: "unix style",
		command: "git diff --staged | halo translate --target vcs-commit-message",
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
		defaultRefineInstruction:
			"emphasize that stdin is translated into a VCS commit message",
		refinedFallbacks: [
			"feat(cli): translate stdin diff input into clearer commit messages",
			"refactor(core): improve stdin-to-commit-message translation flow",
			"fix(cli): preserve multiline stdin input during commit message translation",
		],
		escalatedModels: ESCALATED_MODELS,
		escalatedFallbacks: [
			"feat(cli): turn staged stdin diff input into clearer VCS commit messages",
			"refactor(core): tighten translation from stdin patches to commit message output",
		],
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

function DelayedReplayAction({ onReplay }: { onReplay: () => void }) {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(true);
		}, 1000);

		return () => clearTimeout(timer);
	}, []);

	return (
		<div className="mt-6 min-h-6 pl-4">
			<button
				type="button"
				onClick={onReplay}
				tabIndex={isVisible ? 0 : -1}
				aria-hidden={!isVisible}
				className={`inline-flex items-center gap-2 border-b border-transparent pb-0.5 text-sm text-foreground-muted transition-[opacity,color,border-color] duration-200 ease-out hover:border-current hover:text-foreground focus-visible:border-current focus-visible:text-foreground ${
					isVisible ? "opacity-100" : "pointer-events-none opacity-0"
				}`}
			>
				<RotateCcw
					aria-hidden="true"
					className="h-3.5 w-3.5 shrink-0"
					strokeWidth={1.9}
				/>
				<span>Watch that flow again</span>
			</button>
		</div>
	);
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

interface DemoPromptState {
	kind: PromptKind;
	promptTargetIndex: number;
	value: string;
}

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
			text: `${input.result.edited ? "Edited + selected" : "Selected"}: ${selectedTitle}`,
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

function createCandidatesForDemoRun(
	tab: DemoTab,
	options: {
		models?: string[];
		fallbacks?: string[];
		replayGeneration?: TerminalStreamReplayGeneration | null;
	},
): CreateCandidates {
	const models = options.models ?? tab.models;
	const fallbacks = options.fallbacks ?? tab.fallbacks;
	const replayGeneration =
		options.replayGeneration === undefined
			? tab.replayGeneration
			: options.replayGeneration;

	if (replayGeneration && replayGeneration.events.length > 0) {
		return createCandidatesFromReplayGeneration({
			generation: replayGeneration,
			models,
		});
	}

	return createCandidatesFromDirectCore({
		diff: tab.diff,
		models,
		fallbacks,
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
	const [promptState, setPromptState] = useState<DemoPromptState | null>(null);
	const [selectorRunLine, setSelectorRunLine] = useState(activeDemo.runLine);
	const [contextNote, setContextNote] = useState<string | null>(null);
	const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
	const selectorControllerRef = useRef<TerminalSelectorController | null>(null);
	const promptInputRef = useRef<HTMLInputElement | null>(null);

	const cancelPrompt = useCallback(() => {
		setPromptState(null);
	}, []);

	const destroySelector = useCallback(() => {
		cancelPrompt();
		selectorControllerRef.current?.destroy();
		selectorControllerRef.current = null;
		setSelectorState(null);
		setSelectedResult(null);
	}, [cancelPrompt]);

	const startSelector = useCallback(
		(options?: {
			models?: string[];
			fallbacks?: string[];
			replayGeneration?: TerminalStreamReplayGeneration | null;
			runLine?: string;
			contextNote?: string | null;
		}) => {
			destroySelector();
			const models = options?.models ?? activeDemo.models;
			const candidates = createCandidatesForDemoRun(activeDemo, {
				models,
				fallbacks: options?.fallbacks,
				replayGeneration: options?.replayGeneration,
			});

			const controller = createTerminalSelectorController({
				maxSlots: Math.max(1, models.length),
				models,
				createCandidates: candidates,
				onState: setSelectorState,
			});

			selectorControllerRef.current = controller;
			setSelectedResult(null);
			setSelectorRunLine(options?.runLine ?? activeDemo.runLine);
			setContextNote(options?.contextNote ?? null);
			setSpinnerFrameIndex(0);
			setPhase("selector");
			controller.start();
		},
		[activeDemo, destroySelector],
	);

	useEffect(() => {
		if (activeTab) {
			setPhase("initial");
			setSelectorRunLine(activeDemo.runLine);
			setContextNote(null);
			destroySelector();
		}
	}, [activeDemo.runLine, activeTab, destroySelector]);

	useEffect(() => {
		return () => {
			destroySelector();
		};
	}, [destroySelector]);

	const handleReplay = useCallback(() => {
		destroySelector();
		setSelectorRunLine(activeDemo.runLine);
		setContextNote(null);
		setPhase("initial");
	}, [activeDemo.runLine, destroySelector]);

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
			if (phase !== "selector" || promptState) return;
			selectorControllerRef.current?.setSelection(index);
		},
		[phase, promptState],
	);

	const handleCandidateClick = useCallback(
		(index: number) => {
			if (phase !== "selector" || promptState) return;
			selectorControllerRef.current?.setSelection(index);
			const result = selectorControllerRef.current?.confirm();
			if (result) {
				onResult(result);
			}
		},
		[onResult, phase, promptState],
	);

	const confirmSelection = useCallback(() => {
		if (phase !== "selector" || promptState) return;
		const result = selectorControllerRef.current?.confirm();
		if (result) {
			onResult(result);
		}
	}, [onResult, phase, promptState]);

	const startEscalation = useCallback(() => {
		if (phase !== "selector" || promptState) return;
		startSelector({
			models: activeDemo.escalatedModels,
			fallbacks: activeDemo.escalatedFallbacks,
			replayGeneration: null,
			runLine: "Escalating to stronger models",
			contextNote: "→ Escalate to stronger models",
		});
	}, [
		activeDemo.escalatedFallbacks,
		activeDemo.escalatedModels,
		phase,
		promptState,
		startSelector,
	]);

	useEffect(() => {
		if (!selectorState?.isGenerating) return;
		const timer = setInterval(() => {
			setSpinnerFrameIndex((index) => (index + 1) % SPINNER_FRAMES.length);
		}, 80);
		return () => clearInterval(timer);
	}, [selectorState?.isGenerating]);

	useEffect(() => {
		if (!promptState) return;
		const timer = setTimeout(() => {
			const input = promptInputRef.current;
			if (!input) return;
			input.focus();
			const cursorPosition = input.value.length;
			input.setSelectionRange(cursorPosition, cursorPosition);
		}, 0);
		return () => clearTimeout(timer);
	}, [promptState]);

	const openPrompt = useCallback(
		(kind: PromptKind) => {
			if (phase !== "selector" || promptState || !selectorState) {
				return;
			}
			const selectedSlot = selectorState.slots[selectorState.selectedIndex];
			if (selectedSlot?.status !== "ready") {
				return;
			}
			setPromptState({
				kind,
				promptTargetIndex: selectorState.selectedIndex,
				value:
					kind === "edit"
						? selectedSlot.candidate.content
						: activeDemo.defaultRefineInstruction,
			});
		},
		[activeDemo.defaultRefineInstruction, phase, promptState, selectorState],
	);

	const handleHintAction = useCallback(
		(action: SelectorHintAction) => {
			switch (action) {
				case "confirm":
					confirmSelection();
					return;
				case "edit":
					openPrompt("edit");
					return;
				case "refine":
					openPrompt("refine");
					return;
				case "escalate":
					startEscalation();
					return;
				default:
					return;
			}
		},
		[confirmSelection, openPrompt, startEscalation],
	);

	const submitPrompt = useCallback(() => {
		if (!promptState || !selectorState) {
			return;
		}

		const selectedSlot = selectorState.slots[promptState.promptTargetIndex];
		if (selectedSlot?.status !== "ready") {
			cancelPrompt();
			return;
		}

		if (promptState.kind === "edit") {
			const nextValue = promptState.value.trim();
			setPromptState(null);
			setSelectedResult({
				action: "confirm",
				selected: nextValue || selectedSlot.candidate.content,
				selectedCandidate: selectedSlot.candidate,
				selectedIndex: promptState.promptTargetIndex,
				edited:
					(nextValue || selectedSlot.candidate.content) !==
					selectedSlot.candidate.content,
			});
			setPhase("selected");
			return;
		}

		const guide =
			promptState.value.trim() || activeDemo.defaultRefineInstruction;
		setPromptState(null);
		startSelector({
			fallbacks: activeDemo.refinedFallbacks,
			replayGeneration: null,
			runLine: "Refining commit messages",
			contextNote: `→ Refine: ${guide}`,
		});
	}, [
		activeDemo.defaultRefineInstruction,
		activeDemo.refinedFallbacks,
		cancelPrompt,
		promptState,
		selectorState,
		startSelector,
	]);

	const handlePromptInputKeyDown = useCallback(
		(event: ReactKeyboardEvent) => {
			if (event.key === "Enter") {
				event.preventDefault();
				submitPrompt();
				return;
			}

			if (event.key === "Escape") {
				event.preventDefault();
				cancelPrompt();
			}
		},
		[cancelPrompt, submitPrompt],
	);

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
			if (promptState) {
				if (event.key === "Escape") {
					event.preventDefault();
					cancelPrompt();
				}
				return;
			}

			if (event.key === "e") {
				event.preventDefault();
				openPrompt("edit");
				return;
			}

			if (event.key === "r") {
				event.preventDefault();
				openPrompt("refine");
				return;
			}

			if (event.key === "E" || (event.key === "e" && event.shiftKey)) {
				event.preventDefault();
				startEscalation();
				return;
			}

			const result = selectorControllerRef.current?.handleKey({
				key: event.key,
				ctrlKey: event.ctrlKey,
			});
			if (!result) return;
			event.preventDefault();
			onResult(result);
		},
		[
			cancelPrompt,
			onResult,
			openPrompt,
			phase,
			promptState,
			startEscalation,
			startSelector,
		],
	);

	useEffect(() => {
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onKeyDown]);

	const selectorCopy = {
		runningLabel: `${selectorRunLine}...`,
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
					state: promptState
						? {
								...selectorState,
								mode: "prompt",
								promptKind: promptState.kind,
								promptTargetIndex: promptState.promptTargetIndex,
							}
						: selectorState,
					nowMs: spinnerFrameIndex * 80,
					spinnerFrames: SPINNER_FRAMES,
					bufferText: promptState?.value,
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
					className="h-100 overflow-auto px-4 py-4 text-sm text-foreground-secondary leading-relaxed"
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
							{contextNote && (
								<div className="pl-4 text-foreground-muted/60">
									{contextNote}
								</div>
							)}
							<div className="text-foreground-secondary">
								<SelectorFrame
									lines={selectorLines}
									slotIndices={selectorSlotIndices}
									onHover={handleCandidateHover}
									onClick={handleCandidateClick}
									onHintAction={handleHintAction}
									interactive={!promptState}
									editableSlot={
										promptState?.kind === "edit"
											? {
													value: promptState.value,
													onChange: (value) =>
														setPromptState((current) =>
															current == null ? current : { ...current, value },
														),
													onKeyDown: handlePromptInputKeyDown,
													inputRef: promptInputRef,
												}
											: undefined
									}
									editablePrompt={
										promptState?.kind === "refine"
											? {
													value: promptState.value,
													onChange: (value) =>
														setPromptState((current) =>
															current == null ? current : { ...current, value },
														),
													onKeyDown: handlePromptInputKeyDown,
													inputRef: promptInputRef,
												}
											: undefined
									}
								/>
							</div>
						</div>
					)}

					{phase === "selected" && selectedResult?.selected && (
						<div className="text-sm leading-relaxed">
							<SuccessLine text={stripSuccessPrefix(activeDemo.foundLine)} />
							{contextNote && (
								<div className="pl-4 text-foreground-muted/60">
									{contextNote}
								</div>
							)}
							<div>
								{selectedPhaseLines.map((line, index) =>
									line.kind === "success" ? (
										<SuccessLine
											// biome-ignore lint/suspicious/noArrayIndexKey: static render-only list, no reordering
											key={`${line.text}-${index}`}
											text={line.text}
										/>
									) : (
										<p
											// biome-ignore lint/suspicious/noArrayIndexKey: static render-only list, no reordering
											key={`${line.text}-${index}`}
											className="text-foreground"
										>
											{line.text}
										</p>
									),
								)}
							</div>
							<DelayedReplayAction onReplay={handleReplay} />
						</div>
					)}
				</div>
			</TerminalWindow>
		</div>
	);
}
