"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const COMMIT_MESSAGES = [
	{
		content: "feat(auth): add OAuth2 device flow for CLI authentication",
		model: "mistral/mistral-nemo",
		cost: 0.00012,
	},
	{
		content: "feat: implement device authorization flow with token refresh",
		model: "cerebras/llama-3.1-8b",
		cost: 0.00008,
	},
	{
		content: "feat(cli): add login command with device code verification",
		model: "openai/gpt-5-nano",
		cost: 0.00015,
	},
	{
		content: "feat: OAuth2 device flow integration for CLI",
		model: "xai/grok-code-fast-1",
		cost: 0.0001,
	},
];

type Slot =
	| { status: "pending"; model: string }
	| {
			status: "ready";
			content: string;
			model: string;
			cost: number;
	  };

type Phase =
	| "initial"
	| "typing"
	| "waitingEnter"
	| "analyzing"
	| "generating"
	| "selector"
	| "selected";

function createPendingSlots(): Slot[] {
	return COMMIT_MESSAGES.map((message) => ({
		status: "pending" as const,
		model: message.model,
	}));
}

function formatModelName(model: string): string {
	const parts = model.split("/");
	return parts.length > 1 ? parts[1] : model;
}

function formatTotalCost(totalCost: number): string {
	return `$${totalCost.toFixed(6)}`;
}

function getTotalCost(slots: Slot[]): number {
	return slots.reduce((sum, slot) => {
		if (slot.status === "ready") {
			return sum + slot.cost;
		}
		return sum;
	}, 0);
}

export function TerminalDemo() {
	const [phase, setPhase] = useState<Phase>("initial");
	const [typedText, setTypedText] = useState("");
	const [spinnerFrame, setSpinnerFrame] = useState(0);
	const [generatedCount, setGeneratedCount] = useState(0);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [slots, setSlots] = useState<Slot[]>([]);
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	const command = "git ultrahope commit";

	const reroll = useCallback(() => {
		setPhase("generating");
		setGeneratedCount(0);
		setSelectedIndex(0);
		setSlots(createPendingSlots());
	}, []);

	const readyCount = slots.filter((slot) => slot.status === "ready").length;
	const totalCost = getTotalCost(slots);
	const costSuffix = totalCost > 0 ? ` (total: ${formatTotalCost(totalCost)})` : "";

	// Initial delay before typing starts
	useEffect(() => {
		if (phase !== "initial") return;
		const timeout = setTimeout(() => setPhase("typing"), 1000);
		return () => clearTimeout(timeout);
	}, [phase]);

	// Typing phase - auto start
	useEffect(() => {
		if (phase !== "typing") return;
		if (typedText.length >= command.length) {
			setTimeout(() => setPhase("waitingEnter"), 300);
			return;
		}
		const timeout = setTimeout(
			() => {
				setTypedText(command.slice(0, typedText.length + 1));
			},
			60 + Math.random() * 40,
		);
		return () => clearTimeout(timeout);
	}, [phase, typedText, command]);

	// Waiting for Enter - keyboard/click handler
	useEffect(() => {
		if (phase !== "waitingEnter") return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				setPhase("analyzing");
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [phase]);

	const handleContinue = useCallback(() => {
		if (phase === "waitingEnter") {
			setPhase("analyzing");
		}
	}, [phase]);

	// Analyzing phase
	useEffect(() => {
		if (phase !== "analyzing") return;
		const timeout = setTimeout(() => {
			setGeneratedCount(0);
			setSelectedIndex(0);
			setSlots(createPendingSlots());
			setPhase("generating");
		}, 800);
		return () => clearTimeout(timeout);
	}, [phase]);

	// Generating phase - spinner
	useEffect(() => {
		if (phase !== "generating") return;
		const interval = setInterval(() => {
			setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
		}, 80);
		return () => clearInterval(interval);
	}, [phase]);

	// Generating phase - fill slots
	useEffect(() => {
		if (phase !== "generating") return;

		if (generatedCount >= COMMIT_MESSAGES.length) {
			const timeout = setTimeout(() => {
				setSlots((prev) => prev.filter((slot) => slot.status === "ready"));
				setSelectedIndex(0);
				setPhase("selector");
			}, 300);
			return () => clearTimeout(timeout);
		}

		const delay = 400 + Math.random() * 600;
		const timeout = setTimeout(() => {
			const nextMessage = COMMIT_MESSAGES[generatedCount];
			setSlots((prev) => {
				const next = [...prev];
				next[generatedCount] = {
					status: "ready",
					content: nextMessage.content,
					model: nextMessage.model,
					cost: nextMessage.cost,
				};
				return next;
			});
			setGeneratedCount((count) => count + 1);
		}, delay);

		return () => clearTimeout(timeout);
	}, [phase, generatedCount]);

	// Keyboard navigation for selector and selected phases
	useEffect(() => {
		if (phase !== "selector" && phase !== "selected") return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "r") {
				e.preventDefault();
				reroll();
				return;
			}

			if (phase === "selected") {
				return;
			}

			if (e.key === "ArrowUp" || e.key === "k") {
				e.preventDefault();
				setSelectedIndex((i) => Math.max(0, i - 1));
			} else if (e.key === "ArrowDown" || e.key === "j") {
				e.preventDefault();
				setSelectedIndex((i) => Math.min(slots.length - 1, i + 1));
			} else if (e.key === "Enter") {
				e.preventDefault();
				setPhase("selected");
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [phase, reroll, slots.length]);

	// Auto-scroll to bottom when content changes
	useEffect(() => {
		if (contentRef.current) {
			contentRef.current.scrollTop = contentRef.current.scrollHeight;
		}
	});

	return (
		// biome-ignore lint/a11y/useSemanticElements: Container with complex children, not a simple button
		<div
			ref={containerRef}
			className="rounded-2xl border border-border-subtle bg-canvas-dark overflow-hidden font-mono text-sm"
			role="button"
			tabIndex={0}
			onClick={handleContinue}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					handleContinue();
				}
			}}
		>
			{/* Terminal header */}
			<div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle bg-surface">
				<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/60" />
				<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/40" />
				<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
				<span className="ml-3 text-xs text-foreground-secondary">
					ultrahope demo
				</span>
			</div>

			{/* Terminal content */}
			<div
				ref={contentRef}
				className="px-6 py-6 h-105 overflow-auto leading-relaxed text-foreground-secondary"
			>
				{/* Command line */}
				<div className="flex items-center">
					<span className="text-foreground">$</span>
					<span className="text-foreground">&nbsp;{typedText}</span>
					{(phase === "initial" || phase === "typing") && (
						<span className="ml-0.5 w-2 h-5 bg-foreground animate-pulse" />
					)}
					{phase === "waitingEnter" && (
						<span className="ml-4 text-foreground-muted text-sm animate-pulse">
							press enter to continue ↵
						</span>
					)}
				</div>

				{/* Found staged changes */}
				{(phase === "analyzing" ||
					phase === "generating" ||
					phase === "selector" ||
					phase === "selected") && (
					<div className="mt-4 text-green-400">
						✔ Found 1 file, 5 insertions, 3 deletions
					</div>
				)}

				{/* Generating header */}
				{phase === "generating" && (
					<div className="mt-2 text-yellow-400">
						<span>{SPINNER_FRAMES[spinnerFrame]}</span>
						<span className="ml-2">
							Generating commit messages... {readyCount}/{COMMIT_MESSAGES.length}
							{costSuffix}
						</span>
					</div>
				)}

				{/* Selector header */}
				{(phase === "selector" || phase === "selected") && (
					<>
						<div className="mt-2 text-green-400">
							✔ {slots.length} commit messages generated
							{costSuffix}
						</div>
						<div className="mt-2">
							<span className="text-cyan-400">?</span>
							<span className="ml-2">Select a commit message</span>
							<span className="ml-2 text-foreground-muted">
								↑↓ navigate ⏎ confirm r reroll
							</span>
						</div>
					</>
				)}

				{/* Slots */}
				{(phase === "generating" || phase === "selector" || phase === "selected") && (
					<div className="mt-4 space-y-3">
						{slots.map((slot, i) => {
							if (slot.status === "pending") {
								return (
									<div key={`pending-${slot.model}`} className="opacity-60">
										<div className="flex items-center gap-2">
											<span className="text-foreground-muted">○</span>
											<span>Generating...</span>
										</div>
										<div className="ml-6 text-foreground-muted text-xs">
											{formatModelName(slot.model)}
										</div>
									</div>
								);
							}

							const isSelected = i === selectedIndex;
							return (
								// biome-ignore lint/a11y/useSemanticElements: Interactive list item with complex children
								<div
									key={`ready-${slot.model}`}
									className={`cursor-pointer transition-opacity ${
										isSelected ? "opacity-100" : "opacity-50"
									}`}
									role="button"
									tabIndex={0}
									onMouseEnter={() =>
										(phase === "selector" || phase === "selected") &&
										setSelectedIndex(i)
									}
									onClick={(e) => {
										e.stopPropagation();
										if (phase === "selector") {
											setSelectedIndex(i);
											setPhase("selected");
										}
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.stopPropagation();
											if (phase === "selector") {
												setSelectedIndex(i);
												setPhase("selected");
											}
										}
									}}
								>
									<div className="flex items-center gap-2">
										<span className={isSelected ? "text-foreground" : "text-foreground-muted"}>
											{isSelected ? "●" : "○"}
										</span>
										<span className={isSelected ? "font-bold text-foreground" : ""}>
											{slot.content}
										</span>
									</div>
									<div className="ml-6 text-cyan-400 text-xs">
										{formatModelName(slot.model)} ${slot.cost.toFixed(6)}
									</div>
								</div>
							);
						})}
					</div>
				)}

				{phase === "selected" && (
					<div className="mt-4 text-foreground-muted text-sm animate-pulse">
						press r to reroll
					</div>
				)}
			</div>
		</div>
	);
}
