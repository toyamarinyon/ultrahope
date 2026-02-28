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
	SelectorSlotViewModel,
} from "../../shared/terminal-selector-view-model";
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
	quit: "(q)uit",
};

function renderSlotLine(slot: SelectorSlotViewModel): string[] {
	const selected = slot.selected;
	const radio = `${selected ? `${theme.success}●` : `${theme.dim}○`}${
		theme.reset
	}`;
	const linePrefix = `  ${radio} `;
	const titleColor = selected ? theme.primary : theme.dim;
	const titleFont = selected ? theme.bold : "";
	const lines = [
		`${linePrefix}${titleColor}${titleFont}${slot.title}${theme.reset}`,
	];
	if (slot.meta) {
		const metaColor = slot.muted ? theme.dim : theme.primary;
		lines.push(`    ${metaColor}${slot.meta}${theme.reset}`);
	}
	return lines;
}

function renderHintLine(
	viewModelHintActions: SelectorHintAction[],
	readyCount: number,
): string {
	const hasReady = readyCount > 0;
	const canNavigate = readyCount >= 2;
	const canEdit = hasReady;
	const canRefine = hasReady;
	const canQuit = true;
	const canConfirm = hasReady;
	const canClickConfirm = hasReady;

	const actionSet = new Set(viewModelHintActions);
	const asHint = (label: string, enabled: boolean): string =>
		enabled ? label : `${theme.dim}${label}${theme.reset}`;

	const labels = [
		actionSet.has("navigate")
			? asHint(SELECTOR_HINT_LABELS.navigate, canNavigate)
			: "",
		actionSet.has("edit") ? asHint(SELECTOR_HINT_LABELS.edit, canEdit) : "",
		actionSet.has("refine")
			? asHint(SELECTOR_HINT_LABELS.refine, canRefine)
			: "",
		actionSet.has("quit") ? asHint(SELECTOR_HINT_LABELS.quit, canQuit) : "",
		actionSet.has("confirm")
			? asHint(SELECTOR_HINT_LABELS.confirm, canConfirm)
			: "",
		actionSet.has("clickConfirm")
			? asHint(SELECTOR_HINT_LABELS.clickConfirm, canClickConfirm)
			: "",
	].filter((line) => line !== "");

	return labels.length > 0 ? `  ${labels.join(" | ")}` : "";
}

function renderPromptLines(frame: SelectorRenderFrame): string[] {
	const prompt = frame.prompt;
	if (!prompt) {
		return [];
	}

	const lines: string[] = [];
	if (prompt.selectedLine) {
		lines.push(ui.success(prompt.selectedLine));
	}

	if (prompt.kind === "edit") {
		lines.push("");
		lines.push(`    ${ui.hint(prompt.modeLine)}`);
		return lines;
	}

	lines.push("");
	lines.push(ui.hint(prompt.modeLine));
	lines.push(`${ui.hint(prompt.targetLineLabel)} ${prompt.targetText}`);
	lines.push(prompt.costLine);
	lines.push("");
	lines.push(prompt.questionLine);
	return lines;
}

function renderSelectorLinesFromRenderFrame(
	frame: SelectorRenderFrame,
): string[] {
	const lines: string[] = [];
	const viewModel = frame.viewModel;
	const costSuffix =
		viewModel.header.totalCostLabel != null
			? ` (total: ${viewModel.header.totalCostLabel})`
			: "";

	if (viewModel.header.mode === "running") {
		lines.push(
			`${theme.progress}${viewModel.header.spinner}${theme.reset} ${theme.primary}${viewModel.header.runningLabel} ${viewModel.header.progress}${costSuffix}${theme.reset}`,
		);
	} else {
		lines.push(ui.success(`${viewModel.header.generatedLabel}${costSuffix}`));
	}

	if (frame.mode === "prompt") {
		lines.push(...renderPromptLines(frame));
		return lines;
	}

	lines.push("");
	for (const slot of viewModel.slots) {
		for (const line of renderSlotLine(slot)) {
			lines.push(line);
		}
		lines.push("");
	}

	if (viewModel.editedSummary) {
		lines.push("");
		lines.push(ui.success(`Edited: ${viewModel.editedSummary}`));
	}

	const readyCount = viewModel.slots.filter(
		(slot) => slot.status === "ready",
	).length;
	lines.push(
		renderHintLine(viewModel.hint.actions, readyCount) ||
			renderHintLine(
				["navigate", "edit", "refine", "quit", "confirm"],
				readyCount,
			),
	);

	return lines;
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
