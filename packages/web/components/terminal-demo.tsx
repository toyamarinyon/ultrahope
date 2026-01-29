"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const COMMIT_MESSAGES = [
	{
		content: "feat(auth): add OAuth2 device flow for CLI authentication",
		model: "mistral/mistral-nemo",
		cost: "$0.00012",
	},
	{
		content: "feat: implement device authorization flow with token refresh",
		model: "cerebras/llama-3.1-8b",
		cost: "$0.00008",
	},
	{
		content: "feat(cli): add login command with device code verification",
		model: "openai/gpt-5-nano",
		cost: "$0.00015",
	},
	{
		content: "feat: OAuth2 device flow integration for CLI",
		model: "xai/grok-code-fast-1",
		cost: "$0.00010",
	},
];

type Phase =
	| "initial"
	| "typing"
	| "waitingEnter"
	| "analyzing"
	| "generating"
	| "selector"
	| "committed";

export function TerminalDemo() {
	const [phase, setPhase] = useState<Phase>("initial");
	const [typedText, setTypedText] = useState("");
	const [spinnerFrame, setSpinnerFrame] = useState(0);
	const [generatedCount, setGeneratedCount] = useState(0);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [visibleMessages, setVisibleMessages] = useState<
		typeof COMMIT_MESSAGES
	>([]);
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	const command = "git ultrahope commit";

	const reset = useCallback(() => {
		setPhase("initial");
		setTypedText("");
		setSpinnerFrame(0);
		setGeneratedCount(0);
		setSelectedIndex(0);
		setVisibleMessages([]);
	}, []);

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
	}, [phase, typedText]);

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
		const timeout = setTimeout(() => setPhase("generating"), 800);
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

	// Generating phase - add messages
	useEffect(() => {
		if (phase !== "generating") return;
		if (generatedCount >= COMMIT_MESSAGES.length) {
			setTimeout(() => setPhase("selector"), 300);
			return;
		}
		const delay = 400 + Math.random() * 600;
		const timeout = setTimeout(() => {
			setVisibleMessages((prev) => [...prev, COMMIT_MESSAGES[generatedCount]]);
			setGeneratedCount((c) => c + 1);
		}, delay);
		return () => clearTimeout(timeout);
	}, [phase, generatedCount]);

	// Keyboard navigation for selector and committed
	useEffect(() => {
		if (phase !== "selector" && phase !== "committed") return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (phase === "committed") {
				if (e.key === "r") {
					e.preventDefault();
					reset();
				}
				return;
			}
			if (e.key === "ArrowUp" || e.key === "k") {
				e.preventDefault();
				setSelectedIndex((i) => Math.max(0, i - 1));
			} else if (e.key === "ArrowDown" || e.key === "j") {
				e.preventDefault();
				setSelectedIndex((i) => Math.min(visibleMessages.length - 1, i + 1));
			} else if (e.key === "Enter") {
				e.preventDefault();
				setPhase("committed");
			} else if (e.key === "r") {
				e.preventDefault();
				setPhase("generating");
				setGeneratedCount(0);
				setVisibleMessages([]);
				setSelectedIndex(0);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [phase, visibleMessages.length, reset]);

	// Auto-scroll to bottom when content changes
	useEffect(() => {
		if (contentRef.current) {
			contentRef.current.scrollTop = contentRef.current.scrollHeight;
		}
	}, [phase, visibleMessages, selectedIndex]);

	return (
		<div
			ref={containerRef}
			className="rounded-2xl border border-border-subtle bg-canvas-dark overflow-hidden font-mono text-sm"
			onClick={handleContinue}
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

				{/* Analyzing */}
				{(phase === "analyzing" ||
					phase === "generating" ||
					phase === "selector" ||
					phase === "committed") && (
					<div className="mt-4 text-green-400">
						✔ Found 1 file, 5 insertions, 3 deletions
					</div>
				)}

				{/* Generating */}
				{phase === "generating" && (
					<div className="mt-2 text-yellow-400">
						<span>{SPINNER_FRAMES[spinnerFrame]}</span>
						<span className="ml-2">
							Generating commit messages... {generatedCount}/
							{COMMIT_MESSAGES.length}
						</span>
					</div>
				)}

				{/* Selector */}
				{(phase === "selector" || phase === "committed") && (
					<>
						<div className="mt-2 text-green-400">
							✔ {visibleMessages.length} commit messages generated
						</div>
						<div className="mt-2">
							<span className="text-cyan-400">?</span>
							<span className="ml-2">Select a commit message</span>
							<span className="ml-2 text-foreground-muted">
								↑↓ navigate ⏎ confirm e edit r reroll q quit
							</span>
						</div>

						<div className="mt-4 space-y-3">
							{visibleMessages.map((msg, i) => (
								<div
									key={msg.model}
									className={`cursor-pointer transition-opacity ${
										i === selectedIndex ? "opacity-100" : "opacity-50"
									}`}
									onMouseEnter={() =>
										phase === "selector" && setSelectedIndex(i)
									}
									onClick={(e) => {
										e.stopPropagation();
										if (phase === "selector") {
											setSelectedIndex(i);
											setPhase("committed");
										}
									}}
								>
									<div className="flex items-center gap-2">
										<span
											className={
												i === selectedIndex
													? "text-foreground"
													: "text-foreground-muted"
											}
										>
											{i === selectedIndex ? "●" : "○"}
										</span>
										<span
											className={
												i === selectedIndex ? "font-bold text-foreground" : ""
											}
										>
											{msg.content}
										</span>
									</div>
									<div className="ml-6 text-cyan-400 text-xs">
										{msg.model.split("/")[1]} {msg.cost}
									</div>
								</div>
							))}
						</div>
					</>
				)}

				{/* Committed */}
				{phase === "committed" && (
					<div className="mt-6">
						<div className="text-green-400">✔ Message selected</div>
						<div className="text-green-400">✔ Running git commit</div>
						<div className="mt-2 text-foreground-muted">
							[main abc1234] {visibleMessages[selectedIndex]?.content}
						</div>
						<div className="text-foreground-muted">
							1 file changed, 5 insertions(+), 3 deletions(-)
						</div>
						<div className="mt-4 text-foreground-muted text-sm animate-pulse">
							press r to replay
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
