"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	type CandidateWithModel,
	type CreateCandidates,
	createTerminalSelectorController,
	renderSelectorLines,
	type SelectorResult,
	type SelectorState,
	type TerminalSelectorController,
} from "@/lib/terminal-selector";
import { createCandidatesFromTasks } from "@/lib/terminal-selector-effect";

const DEMO_GENERATION_MODE: "mock" = "mock";
const DEMO_USE_MOCK = DEMO_GENERATION_MODE === "mock";

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
}

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
		models: ["mock-0", "mock-1", "mock-2"],
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
		models: ["mock-0", "mock-1", "mock-2"],
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
		models: ["mock-0", "mock-1", "mock-2"],
	},
];

type DemoPhase =
	| "initial"
	| "typing"
	| "waitingEnter"
	| "selector"
	| "selected";

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
		generationId: `${model}-${slotId}`,
	};
}

export function TerminalTabsDemo() {
	const [activeTab, setActiveTab] = useState(DEMO_TABS[0].id);
	const activeDemo =
		DEMO_TABS.find((tab) => tab.id === activeTab) ?? DEMO_TABS[0];
	const [phase, setPhase] = useState<DemoPhase>("initial");
	const [typedText, setTypedText] = useState("");
	const [selectorState, setSelectorState] = useState<SelectorState | null>(
		null,
	);
	const [selectedResult, setSelectedResult] = useState<SelectorResult | null>(
		null,
	);
	const [selectorTick, setSelectorTick] = useState(0);
	const selectorControllerRef = useRef<TerminalSelectorController | null>(null);

	const destroySelector = useCallback(() => {
		selectorControllerRef.current?.destroy();
		selectorControllerRef.current = null;
		setSelectorState(null);
		setSelectedResult(null);
	}, []);

	const startSelector = useCallback(() => {
		destroySelector();
		const candidates = createCandidatesFromDirectCore({
			diff: activeDemo.diff,
			models: activeDemo.models,
			fallbacks: activeDemo.fallbacks,
		});

		const controller = createTerminalSelectorController({
			maxSlots: Math.max(1, activeDemo.fallbacks.length),
			models: activeDemo.models,
			createCandidates: candidates,
			onState: setSelectorState,
		});

		selectorControllerRef.current = controller;
		setSelectorTick(0);
		setSelectedResult(null);
		setPhase("selector");
		controller.start();
	}, [activeDemo, destroySelector]);

	useEffect(() => {
		if (activeTab) {
			setPhase("initial");
			setTypedText("");
			destroySelector();
		}
	}, [activeTab, destroySelector]);

	useEffect(() => {
		return () => {
			destroySelector();
		};
	}, [destroySelector]);

	useEffect(() => {
		if (phase !== "initial") return;
		const timer = setTimeout(() => setPhase("typing"), 220);
		return () => clearTimeout(timer);
	}, [phase]);

	useEffect(() => {
		if (phase !== "typing") return;
		if (typedText.length >= activeDemo.command.length) {
			const timer = setTimeout(() => setPhase("waitingEnter"), 180);
			return () => clearTimeout(timer);
		}

		const timer = setTimeout(() => {
			setTypedText(activeDemo.command.slice(0, typedText.length + 1));
		}, 18);
		return () => clearTimeout(timer);
	}, [phase, typedText, activeDemo.command]);

	useEffect(() => {
		if (!selectorState?.isGenerating) return;
		const timer = setInterval(() => {
			setSelectorTick((value) => value + 1);
		}, 80);
		return () => clearInterval(timer);
	}, [selectorState?.isGenerating]);

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

	const onKeyDown = useCallback(
		(event: KeyboardEvent) => {
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

	const renderedSelectorLines =
		selectorState !== null
			? renderSelectorLines(selectorState, selectorTick * 80, {
					runningLabel: `${activeDemo.runLine}...`,
					hasReadyHint:
						"Select a candidate (↑↓ navigate, enter confirm, r reroll)",
					noReadyHint: "q quit",
				})
			: [];
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
						{typedText}
					</code>
					{(phase === "initial" ||
						phase === "typing" ||
						phase === "waitingEnter") && (
						<span className="flex items-center gap-2 animate-pulse">
							<span className="mt-0.5 h-4 w-2 bg-foreground/90" />
							<span className="text-foreground-muted">
								Press enter to review proposals ↵
							</span>
						</span>
					)}
				</div>

				{(phase === "selector" || phase === "selected") && selectorState && (
					<div className="mt-2 text-sm">
						<p className="text-green-400">{activeDemo.foundLine}</p>
						<pre className="mt-2 whitespace-pre-wrap text-foreground-secondary">
							{renderedSelectorLines.join("\n")}
						</pre>
					</div>
				)}

				{phase === "selected" && selectedResult?.selected && (
					<div className="mt-4">
						<p className="text-green-400">✔ Candidate selected</p>
						<p className="text-green-400">{activeDemo.applyLine}</p>
						<p className="mt-1 text-foreground-muted">
							{selectedResult.selected}
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
