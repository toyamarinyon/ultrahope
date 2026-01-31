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

let pendingHeight = 0;
let committedHeight = 0;

/**
 * Check if stdout supports interactive rendering (cursor movement).
 */
function isTTY(): boolean {
	return process.stdout.isTTY === true;
}

/**
 * Render content to stdout, replacing the previous pending output.
 *
 * Uses cursor movement to overwrite the last rendered content.
 * Call `flush()` to commit the current output and start fresh below.
 *
 * On non-TTY, falls back to simple write (no cursor movement).
 *
 * @param content - The text to render (include `\n` for line breaks)
 */
export function render(content: string): void {
	if (!isTTY()) {
		process.stdout.write(content);
		return;
	}

	if (pendingHeight > 0) {
		readline.moveCursor(process.stdout, 0, -pendingHeight);
		readline.cursorTo(process.stdout, 0);
		readline.clearScreenDown(process.stdout);
	}

	process.stdout.write(content);
	pendingHeight = content.split("\n").length - 1;
}

/**
 * Commit the current pending output to static.
 *
 * After calling flush, new `render()` calls will appear below
 * the committed content instead of replacing it.
 */
export function flush(): void {
	committedHeight += pendingHeight;
	pendingHeight = 0;
}

/**
 * Clear pending output without committing.
 *
 * Wipes the current pending content and resets to the last committed state.
 * Useful before showing error messages.
 */
function _clear(): void {
	if (!isTTY() || pendingHeight === 0) {
		return;
	}

	readline.moveCursor(process.stdout, 0, -pendingHeight);
	readline.cursorTo(process.stdout, 0);
	readline.clearScreenDown(process.stdout);
	pendingHeight = 0;
}

/**
 * Clear all rendered output (both pending and committed).
 *
 * Wipes everything since the renderer started (or last reset).
 * Useful for complete cleanup on abort/error.
 */
export function clearAll(): void {
	if (!isTTY()) {
		return;
	}

	const totalHeight = pendingHeight + committedHeight;
	if (totalHeight > 0) {
		readline.moveCursor(process.stdout, 0, -totalHeight);
		readline.cursorTo(process.stdout, 0);
		readline.clearScreenDown(process.stdout);
	}
	pendingHeight = 0;
	committedHeight = 0;
}

/**
 * Reset height tracking without clearing output.
 *
 * Call this when external code (e.g., editor spawn) may have modified the terminal.
 */
export function reset(): void {
	pendingHeight = 0;
	committedHeight = 0;
}
