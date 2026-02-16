"use client";

import { useCallback, useEffect, useState } from "react";

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

function createPendingSlots(count: number): Slot[] {
	return Array.from({ length: count }, () => ({ status: "pending" as const }));
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
	const [phase, setPhase] = useState<Phase>("initial");
	const [typedText, setTypedText] = useState("");
	const [spinnerFrame, setSpinnerFrame] = useState(0);
	const [generatedCount, setGeneratedCount] = useState(0);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [slots, setSlots] = useState<Slot[]>([]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: activeDemo.id is intentionally used as a reset trigger when the active tab changes
	useEffect(() => {
		setPhase("initial");
		setTypedText("");
		setSpinnerFrame(0);
		setGeneratedCount(0);
		setSelectedIndex(0);
		setSlots([]);
	}, [activeDemo.id]);

	useEffect(() => {
		if (phase !== "initial") return;
		const timeout = setTimeout(() => setPhase("typing"), 500);
		return () => clearTimeout(timeout);
	}, [phase]);

	useEffect(() => {
		if (phase !== "typing") return;
		if (typedText.length >= activeDemo.command.length) {
			const timeout = setTimeout(() => setPhase("waitingEnter"), 480);
			return () => clearTimeout(timeout);
		}
		const timeout = setTimeout(
			() => {
				setTypedText(activeDemo.command.slice(0, typedText.length + 1));
			},
			28 + Math.random() * 24,
		);
		return () => clearTimeout(timeout);
	}, [phase, typedText, activeDemo.command]);

	useEffect(() => {
		if (phase !== "analyzing") return;
		const timeout = setTimeout(() => {
			setGeneratedCount(0);
			setSelectedIndex(0);
			setSlots(createPendingSlots(activeDemo.options.length));
			setPhase("generating");
		}, 680);
		return () => clearTimeout(timeout);
	}, [phase, activeDemo.options.length]);

	useEffect(() => {
		if (phase !== "generating") return;
		const interval = setInterval(() => {
			setSpinnerFrame((current) => (current + 1) % SPINNER_FRAMES.length);
		}, 80);
		return () => clearInterval(interval);
	}, [phase]);

	useEffect(() => {
		if (phase !== "generating") return;
		if (generatedCount >= activeDemo.options.length) {
			const timeout = setTimeout(() => setPhase("selector"), 280);
			return () => clearTimeout(timeout);
		}
		const timeout = setTimeout(
			() => {
				setSlots((prev) => {
					const next = [...prev];
					next[generatedCount] = {
						status: "ready",
						content: activeDemo.options[generatedCount],
					};
					return next;
				});
				setGeneratedCount((count) => count + 1);
			},
			420 + Math.random() * 350,
		);
		return () => clearTimeout(timeout);
	}, [phase, generatedCount, activeDemo.options]);

	const reroll = useCallback(() => {
		setPhase("generating");
		setGeneratedCount(0);
		setSelectedIndex(0);
		setSlots(createPendingSlots(activeDemo.options.length));
	}, [activeDemo.options.length]);

	useEffect(() => {
		if (
			phase !== "waitingEnter" &&
			phase !== "selector" &&
			phase !== "selected"
		)
			return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (phase === "waitingEnter" && event.key === "Enter") {
				if (isInteractiveKeyTarget(event.target)) {
					return;
				}
				event.preventDefault();
				setPhase("analyzing");
				return;
			}

			if (phase === "selector" || phase === "selected") {
				if (event.key === "r") {
					event.preventDefault();
					reroll();
					return;
				}
				if (phase === "selector") {
					if (event.key === "ArrowUp" || event.key === "k") {
						event.preventDefault();
						setSelectedIndex((index) => Math.max(0, index - 1));
					} else if (event.key === "ArrowDown" || event.key === "j") {
						event.preventDefault();
						setSelectedIndex((index) =>
							Math.min(activeDemo.options.length - 1, index + 1),
						);
					} else if (event.key === "Enter") {
						event.preventDefault();
						setPhase("selected");
					}
				}
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [phase, activeDemo.options.length, reroll]);

	const readyCount = slots.filter((slot) => slot.status === "ready").length;
	const selectedSlot =
		slots[selectedIndex] && slots[selectedIndex].status === "ready"
			? slots[selectedIndex]
			: null;
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
							<span
								className={`text-foreground-muted transition-opacity duration-400 ${
									phase === "waitingEnter" ? "opacity-100" : "opacity-0"
								}`}
							>
								press enter to continue ↵
							</span>
						</span>
					)}
				</div>

				{(phase === "analyzing" ||
					phase === "generating" ||
					phase === "selector" ||
					phase === "selected") && (
					<p className="mt-3 text-green-400">{activeDemo.foundLine}</p>
				)}

				{phase === "generating" && (
					<p className="mt-2 text-yellow-400">
						{SPINNER_FRAMES[spinnerFrame]} {activeDemo.runLine}... {readyCount}/
						{activeDemo.options.length}
					</p>
				)}

				{(phase === "selector" || phase === "selected") && (
					<p className="mt-2">
						<span className="text-cyan-400">?</span>
						<span className="ml-2">
							Select a candidate (↑↓ navigate, enter confirm, r reroll)
						</span>
					</p>
				)}

				{(phase === "generating" ||
					phase === "selector" ||
					phase === "selected") && (
					<div className="mt-3 space-y-2">
						{slots.map((slot, index) => {
							if (slot.status === "pending") {
								return (
									<div key={`pending-${String(index)}`} className="opacity-50">
										○ Generating...
									</div>
								);
							}

							const isSelected = index === selectedIndex;
							return (
								<button
									key={`ready-${slot.content}`}
									type="button"
									onMouseEnter={() => setSelectedIndex(index)}
									onClick={() => {
										if (phase === "selector") {
											setSelectedIndex(index);
											setPhase("selected");
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

				{phase === "selected" && (
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
