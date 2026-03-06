"use client";

import type { KeyboardEvent, RefObject } from "react";
import {
	formatSelectorHintActions,
	type SelectorRenderLine,
} from "../../shared/terminal-selector-view-model";

export interface SelectorFrameEditableInput {
	value: string;
	onChange: (value: string) => void;
	onKeyDown: (event: KeyboardEvent) => void;
	inputRef: RefObject<HTMLInputElement | null>;
}

export function SuccessLine({ text }: { text: string }) {
	return (
		<div>
			<span className="text-emerald-400">✔</span>{" "}
			<span className="text-foreground">{text}</span>
		</div>
	);
}

interface RenderLineProps {
	line: SelectorRenderLine;
	slotIndex?: number;
	onHover?: (index: number) => void;
	onClick?: (index: number) => void;
	interactive?: boolean;
	editableSlot?: SelectorFrameEditableInput;
	editablePrompt?: SelectorFrameEditableInput;
}

export function RenderLine({
	line,
	slotIndex,
	onHover,
	onClick,
	interactive,
	editableSlot,
	editablePrompt,
}: RenderLineProps) {
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
			return <SuccessLine text={`${line.label}${line.costSuffix}`} />;
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
							onChange={(event) => editableSlot.onChange(event.target.value)}
							onKeyDown={editableSlot.onKeyDown}
							className="w-[calc(100%-2rem)] border-none bg-transparent text-foreground font-bold caret-emerald-400 outline-none"
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
						className="block w-full cursor-pointer rounded pl-4 text-left hover:bg-surface-hover"
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
							onChange={(event) => editablePrompt.onChange(event.target.value)}
							onKeyDown={editablePrompt.onKeyDown}
							className="w-[calc(100%-8rem)] border-none bg-transparent text-foreground-secondary caret-foreground outline-none"
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
				return (
					<div className="pl-4 text-foreground-muted/60">
						{formatSelectorHintActions(line.actions, "web")}
					</div>
				);
			}
			return <div className="pl-4 text-foreground-muted/60">{line.text}</div>;
		case "editedSummary":
			return (
				<div>
					<span className="text-emerald-400">Edited:</span> {line.text}
				</div>
			);
	}
}

export interface SelectorFrameProps {
	lines: SelectorRenderLine[];
	slotIndices?: Map<number, number>;
	onHover?: (index: number) => void;
	onClick?: (index: number) => void;
	interactive?: boolean;
	editableSlot?: SelectorFrameEditableInput;
	editablePrompt?: SelectorFrameEditableInput;
}

export function SelectorFrame({
	lines,
	slotIndices,
	onHover,
	onClick,
	interactive,
	editableSlot,
	editablePrompt,
}: SelectorFrameProps) {
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
