/**
 * # renderer
 *
 * A minimal, dependency-free CLI rendering library for building interactive terminal UIs.
 *
 * ## Why
 *
 * Full frameworks like `ink` provide React-style terminal rendering but add significant
 * dependencies (~2MB). For simple CLIs that need spinners, status updates, and prompts,
 * a thin abstraction over `readline` cursor control is often enough.
 *
 * This module implements the core pattern: **state → view → render** with height tracking
 * to enable in-place updates (like spinners) that can be "committed" to static output.
 *
 * ## Architecture
 *
 * Three component types:
 * - **Pending**: Animated/updating content (spinners). Uses `render()` to update in-place.
 * - **Static**: Finalized content. Call `flush()` to commit pending → static.
 * - **Input**: Interactive prompts. Use `readline.createInterface()` after flushing.
 *
 * ## Usage
 *
 * ```typescript
 * import { render, flush, SPINNER_FRAMES } from "./renderer";
 *
 * // Spinner loop (pending → static)
 * let frame = 0;
 * const interval = setInterval(() => {
 *   render(`${SPINNER_FRAMES[frame++ % SPINNER_FRAMES.length]} Loading...\n`);
 * }, 80);
 * await someAsyncWork();
 * clearInterval(interval);
 * render("✔ Done\n");
 * flush();
 *
 * // Manual pending updates
 * render("⠋ Processing 1/3...\n");
 * render("⠙ Processing 2/3...\n");
 * render("✔ Processed 3 items\n");
 * flush(); // Commit — future renders appear below
 *
 * // Static output (just use console.log after flush)
 * console.log("  • Item 1\n  • Item 2");
 *
 * // Error handling: clearAll() wipes all output for clean error display
 * ```
 */

import * as readline from "node:readline";
import type {
	SelectorHintAction,
	SelectorRenderFrame,
	SelectorRenderLine,
} from "../../shared/terminal-selector-view-model";
import { buildSelectorRenderLines } from "../../shared/terminal-selector-view-model";
import { theme } from "./theme";
import { ui } from "./ui";

export const SPINNER_FRAMES = [
	"⠋",
	"⠙",
	"⠹",
	"⠸",
	"⠼",
	"⠴",
	"⠦",
	"⠧",
	"⠇",
	"⠏",
];

function isTTY(output: NodeJS.WriteStream): boolean {
	return output.isTTY === true;
}

const ANSI_SEQUENCE_PATTERN = new RegExp(
	`${String.fromCharCode(27)}\\[[0-9;]*m`,
	"g",
);

function stripAnsiCodes(value: string): string {
	return value.replace(ANSI_SEQUENCE_PATTERN, "");
}

function estimateVisualLineCount(content: string, columns: number): number {
	if (columns <= 0) {
		columns = 80;
	}

	const normalized = content.replace(/\r/g, "");
	const hasTrailingNewline = normalized.endsWith("\n");
	const lines = hasTrailingNewline
		? normalized.slice(0, -1).split("\n")
		: normalized.split("\n");
	return lines.reduce((total, line) => {
		const visibleLength = stripAnsiCodes(line).length;
		const wrapped = Math.max(1, Math.ceil(visibleLength / columns));
		return total + wrapped;
	}, 0);
}

const SELECTOR_HINT_LABELS: Record<SelectorHintAction, string> = {
	navigate: "↑↓ navigate",
	confirm: "⏎ confirm",
	clickConfirm: "click confirm",
	edit: "(e)dit",
	refine: "(r)efine",
	escalate: "(E)scalate",
	quit: "(q)uit",
};

function renderHintActions(actions: SelectorHintAction[]): string {
	if (actions.length === 0) return "";
	const labels = actions.map((a) => SELECTOR_HINT_LABELS[a]).filter(Boolean);
	return labels.length > 0 ? `  ${labels.join(" | ")}` : "";
}

function renderLineToString(line: SelectorRenderLine): string {
	switch (line.type) {
		case "headerRunning":
			return `${theme.progress}${line.spinner}${theme.reset} ${theme.primary}${line.label} ${line.progress}${line.costSuffix}${theme.reset}`;
		case "headerDone":
			return ui.success(`${line.label}${line.costSuffix}`);
		case "blank":
			return "";
		case "slot": {
			if (line.radio === ">") {
				return `  ${theme.success}>${theme.reset} ${line.title}`;
			}
			const radioStr = `${line.selected ? `${theme.success}●` : `${theme.dim}○`}${theme.reset}`;
			const titleColor = line.selected ? theme.primary : theme.dim;
			const titleFont = line.selected ? theme.bold : "";
			return `  ${radioStr} ${titleColor}${titleFont}${line.title}${theme.reset}`;
		}
		case "slotMeta": {
			const metaColor = line.muted ? theme.dim : theme.primary;
			return `    ${metaColor}${line.text}${theme.reset}`;
		}
		case "promptInput":
			return `${theme.primary}${line.prefix}${theme.reset}${line.text}`;
		case "placeholder":
			return `${theme.dim}${line.text}${theme.reset}`;
		case "hint":
			if (line.actions.length > 0) {
				return renderHintActions(line.actions);
			}
			return `  ${ui.hint(line.text)}`;
		case "editedSummary":
			return ui.success(`Edited: ${line.text}`);
	}
}

function renderSelectorLinesFromRenderFrame(
	frame: SelectorRenderFrame,
): string[] {
	return buildSelectorRenderLines(frame).map(renderLineToString);
}

export function renderSelectorTextFromRenderFrame(
	frame: SelectorRenderFrame,
): string {
	return `${renderSelectorLinesFromRenderFrame(frame).join("\n")}\n`;
}

/**
 * Render content to the provided output, replacing the previous pending output.
 *
 * Uses cursor movement to overwrite the last rendered content.
 * Call `flush()` to commit the current output and start fresh below.
 *
 * On non-TTY, falls back to simple write (no cursor movement).
 *
 * @param content - The text to render (include `\n` for line breaks)
 */
export function createRenderer(output: NodeJS.WriteStream) {
	let pendingHeight = 0;
	let committedHeight = 0;

	const render = (content: string): void => {
		if (!isTTY(output)) {
			output.write(content);
			return;
		}

		if (pendingHeight > 0) {
			readline.moveCursor(output, 0, -pendingHeight);
			readline.cursorTo(output, 0);
			readline.clearScreenDown(output);
		}

		output.write(content);
		pendingHeight = estimateVisualLineCount(content, output.columns ?? 80);
	};

	const renderSelectorFrame = (frame: SelectorRenderFrame): void => {
		render(renderSelectorTextFromRenderFrame(frame));
	};

	const flush = (): void => {
		committedHeight += pendingHeight;
		pendingHeight = 0;
	};

	/**
	 * remove all pending/committed lines and reset cursor position to the prompt entry point.
	 * This should be called by the selector UI whenever it enters a modal/input flow
	 * so that terminal state is reconstructed through a single `render()` call on return.
	 */
	const clearAll = (): void => {
		if (!isTTY(output)) {
			return;
		}

		const totalHeight = pendingHeight + committedHeight;
		if (totalHeight > 0) {
			readline.moveCursor(output, 0, -totalHeight);
			readline.cursorTo(output, 0);
			readline.clearScreenDown(output);
		}
		pendingHeight = 0;
		committedHeight = 0;
	};

	/**
	 * reset internal height counters without touching screen contents.
	 * Unlike `clearAll`, this must only be used when the caller already owns the
	 * terminal and wants to drop renderer bookkeeping (e.g., on shutdown).
	 */
	const reset = (): void => {
		pendingHeight = 0;
		committedHeight = 0;
	};

	return {
		render,
		renderSelectorFrame,
		flush,
		clearAll,
		reset,
	};
}
