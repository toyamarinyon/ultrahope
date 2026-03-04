import * as readline from "node:readline";
import type { Story, StoryGroup } from "./stories/types";

const ANSI_CLEAR_SCREEN = "\x1b[2J";
const ANSI_CURSOR_HOME = "\x1b[H";
const ANSI_HIDE_CURSOR = "\x1b[?25l";
const ANSI_SHOW_CURSOR = "\x1b[?25h";
const ANSI_RESET = "\x1b[0m";

// biome-ignore lint/suspicious/noControlCharactersInRegex: Matching terminal ANSI CSI escape sequences by design.
const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*[A-Za-z]/g;

interface StoryPath {
	groupIndex: number;
	storyIndex: number;
}

interface GroupRow {
	kind: "group";
	groupIndex: number;
	name: string;
	expanded: boolean;
}

interface StoryRow {
	kind: "story";
	groupIndex: number;
	storyIndex: number;
	name: string;
}

type TreeRow = GroupRow | StoryRow;

interface Geometry {
	leftColumns: number;
	rightColumns: number;
	bodyRows: number;
	totalColumns: number;
}

function getGeometry(): Geometry {
	const terminalColumns = Math.max(72, process.stdout.columns ?? 80);
	const terminalRows = Math.max(16, process.stdout.rows ?? 20);

	const leftColumns = Math.max(24, Math.floor(terminalColumns * 0.3));
	const rightColumns = Math.max(
		1,
		terminalColumns - leftColumns - 3, // left border + divider + right border
	);
	const bodyRows = Math.max(1, terminalRows - 4); // header + footer + status row

	return {
		leftColumns,
		rightColumns,
		bodyRows,
		totalColumns: leftColumns + rightColumns + 3,
	};
}

function stripAnsiCodes(value: string): string {
	return value.replace(ANSI_ESCAPE_PATTERN, "");
}

function truncateWithAnsi(value: string, width: number): string {
	if (width <= 0) {
		return "";
	}

	let cursor = 0;
	let visibleLength = 0;
	let output = "";

	while (cursor < value.length && visibleLength < width) {
		const char = value[cursor];
		if (char === "\x1b" && value[cursor + 1] === "[") {
			let end = cursor + 2;
			let escapeChar = value.charAt(end);
			while (
				end < value.length &&
				escapeChar !== "" &&
				/^[0-9;]$/.test(escapeChar) === false &&
				/[A-Za-z]/.test(escapeChar) === false
			) {
				end += 1;
				escapeChar = value.charAt(end);
			}
			while (end < value.length && /[A-Za-z]/.test(escapeChar) === false) {
				end += 1;
				escapeChar = value.charAt(end);
			}
			if (escapeChar === "") {
				escapeChar = value.charAt(value.length);
			}
			while (end < value.length && /[A-Za-z]/.test(escapeChar) === false) {
				end += 1;
				escapeChar = value.charAt(end);
			}
			if (end < value.length) {
				end += 1;
				output += value.slice(cursor, end);
				cursor = end;
				continue;
			}
		}
		output += char;
		visibleLength += 1;
		cursor += 1;
	}

	return output;
}

function fitLineToWidth(value: string, width: number): string {
	const visibleLength = stripAnsiCodes(value).length;
	const truncated =
		visibleLength > width ? truncateWithAnsi(value, width) : value;
	const normalized = truncated;
	const visible = stripAnsiCodes(normalized).length;
	if (visible >= width) {
		return truncated;
	}
	return `${normalized}${" ".repeat(width - visible)}`;
}

function buildTopBorder(leftColumns: number, rightColumns: number): string {
	const leftTitle = withHeaderTitle(leftColumns, "Stories");
	const rightTitle = withHeaderTitle(rightColumns, "Preview");
	return `┌${leftTitle}┬${rightTitle}┐`;
}

function withHeaderTitle(width: number, title: string): string {
	const decorated = ` ${title} `;
	if (decorated.length >= width) {
		return decorated.slice(0, width);
	}
	const sideFill = width - decorated.length;
	const leftFill = Math.floor(sideFill / 2);
	const rightFill = sideFill - leftFill;
	return `${"─".repeat(leftFill)}${decorated}${"─".repeat(rightFill)}`;
}

function buildBottomBorder(leftColumns: number, rightColumns: number): string {
	return `└${"─".repeat(leftColumns)}┴${"─".repeat(rightColumns)}┘`;
}

function buildRows(
	storyGroups: StoryGroup[],
	expandedGroups: Set<number>,
): TreeRow[] {
	const rows: TreeRow[] = [];

	for (let groupIndex = 0; groupIndex < storyGroups.length; groupIndex += 1) {
		const group = storyGroups[groupIndex];
		if (!group) {
			continue;
		}

		rows.push({
			kind: "group",
			groupIndex,
			name: group.name,
			expanded: expandedGroups.has(groupIndex),
		});

		if (expandedGroups.has(groupIndex)) {
			for (
				let storyIndex = 0;
				storyIndex < group.stories.length;
				storyIndex += 1
			) {
				const story = group.stories[storyIndex];
				if (!story) {
					continue;
				}
				rows.push({
					kind: "story",
					groupIndex,
					storyIndex,
					name: story.name,
				});
			}
		}
	}

	return rows;
}

function getFirstStoryPath(storyGroups: StoryGroup[]): StoryPath | null {
	for (let groupIndex = 0; groupIndex < storyGroups.length; groupIndex += 1) {
		if (storyGroups[groupIndex]?.stories?.length) {
			return {
				groupIndex,
				storyIndex: 0,
			};
		}
	}
	return null;
}

function getActiveStory(
	storyGroups: StoryGroup[],
	activeStory: StoryPath | null,
): Story | null {
	if (!activeStory) {
		return null;
	}
	const group = storyGroups[activeStory.groupIndex];
	return group?.stories[activeStory.storyIndex] ?? null;
}

function formatHintLine(activeStory: Story | null): string {
	const storyHint = activeStory ? ` active: ${activeStory.name}` : "";
	return `  ↑↓ select  ←→ collapse/expand  ⏎ select  (q)uit${storyHint}`;
}

function formatTreeRow(
	row: TreeRow,
	isFocused: boolean,
	isActiveStory: boolean,
): string {
	if (row.kind === "group") {
		const marker = row.expanded ? "▼" : "▶";
		return `${isFocused ? "▶" : " "} ${marker} ${row.name}`;
	}

	const bullet = isActiveStory ? "●" : "○";
	return `${isFocused ? ">" : " "}   ${bullet} ${row.name}`;
}

export async function runStoryViewer(storyGroups: StoryGroup[]): Promise<void> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		console.log("Story viewer needs a TTY terminal.");
		return;
	}

	const expandedGroups = new Set<number>(
		storyGroups.map((_, groupIndex) => groupIndex),
	);
	const rows = buildRows(storyGroups, expandedGroups);
	let visibleRows = [...rows];
	if (rows.length === 0) {
		console.log("No story groups configured.");
		return;
	}

	const activeStoryPath = getFirstStoryPath(storyGroups);
	const initialStoryRow = visibleRows.findIndex((row) => row.kind === "story");
	let selectedRowIndex = Math.max(
		0,
		initialStoryRow >= 0 ? initialStoryRow : visibleRows.length - 1,
	);
	let activePath = activeStoryPath;
	let animationTimer: ReturnType<typeof setInterval> | null = null;
	let animationTick = 0;
	let closed = false;

	let onResizeRef: () => void = () => {};

	const stdin = process.stdin;
	const stdout = process.stdout;
	const ttyInput = stdin;
	const setRawMode = (enabled: boolean) => {
		const input = ttyInput as unknown as {
			setRawMode?: (enabled: boolean) => void;
		};
		if (typeof input.setRawMode === "function") {
			input.setRawMode(enabled);
		}
	};

	const stopAnimation = () => {
		if (animationTimer !== null) {
			clearInterval(animationTimer);
			animationTimer = null;
		}
	};

	const rerender = () => {
		if (closed) {
			return;
		}

		const geometry = getGeometry();
		visibleRows = buildRows(storyGroups, expandedGroups);

		if (visibleRows.length === 0) {
			return;
		}

		if (selectedRowIndex >= visibleRows.length) {
			selectedRowIndex = visibleRows.length - 1;
		}

		if (selectedRowIndex < 0) {
			selectedRowIndex = 0;
		}

		const activeStory = getActiveStory(storyGroups, activePath);
		const storyContentWidth = Math.max(1, geometry.rightColumns);
		const storyContent = activeStory
			? activeStory.animate
				? activeStory.animate(animationTick, storyContentWidth)
				: activeStory.render(storyContentWidth)
			: "No story selected.";
		const storyLines = storyContent.replace(/\r/g, "").split("\n");

		const bodyRows = new Array(geometry.bodyRows).fill("");
		for (let lineIndex = 0; lineIndex < geometry.bodyRows; lineIndex += 1) {
			const row = visibleRows[lineIndex] ?? null;
			const isFocused = lineIndex === selectedRowIndex;
			const leftCell = row
				? formatTreeRow(
						row,
						isFocused,
						row.kind === "story" &&
							activePath !== null &&
							row.groupIndex === activePath.groupIndex &&
							row.storyIndex === activePath.storyIndex,
					)
				: "";
			const leftText = fitLineToWidth(leftCell, geometry.leftColumns);

			const previewLine = storyLines[lineIndex] ?? "";
			const previewText = fitLineToWidth(previewLine, geometry.rightColumns);

			bodyRows[lineIndex] = `│${leftText}│${previewText}│`;
		}

		const frame: string[] = [
			buildTopBorder(geometry.leftColumns, geometry.rightColumns),
			...bodyRows,
			buildBottomBorder(geometry.leftColumns, geometry.rightColumns),
			fitLineToWidth(formatHintLine(activeStory), geometry.totalColumns),
		];

		stdout.write(`${ANSI_CLEAR_SCREEN}${ANSI_CURSOR_HOME}${frame.join("\n")}`);
	};

	const startAnimation = () => {
		stopAnimation();
		const activeStory = getActiveStory(storyGroups, activePath);
		if (!activeStory?.animate) {
			animationTick = 0;
			rerender();
			return;
		}

		animationTick = 0;
		animationTimer = setInterval(() => {
			animationTick += 1;
			rerender();
		}, 80);
		rerender();
	};

	const selectActiveStory = (row: StoryRow) => {
		const story = storyGroups[row.groupIndex]?.stories[row.storyIndex];
		if (!story) {
			return;
		}
		activePath = { groupIndex: row.groupIndex, storyIndex: row.storyIndex };
		startAnimation();
	};

	const updateSelection = (direction: -1 | 1) => {
		if (visibleRows.length === 0) {
			return;
		}
		selectedRowIndex = Math.min(
			Math.max(0, selectedRowIndex + direction),
			visibleRows.length - 1,
		);
		rerender();
	};

	const onKeypress = (_character: string, key?: readline.Key) => {
		if (!key || closed) {
			return;
		}

		if (key.ctrl && key.name === "c") {
			closeViewer();
			return;
		}

		const row = visibleRows[selectedRowIndex];
		if (!row) {
			return;
		}

		switch (key.name) {
			case "up": {
				updateSelection(-1);
				break;
			}

			case "down": {
				updateSelection(1);
				break;
			}

			case "left": {
				if (row.kind === "group" && row.expanded) {
					expandedGroups.delete(row.groupIndex);
					rerender();
				}
				break;
			}

			case "right": {
				if (row.kind === "group" && !row.expanded) {
					expandedGroups.add(row.groupIndex);
					rerender();
				}
				break;
			}

			case "return":
			case "enter": {
				if (row.kind === "group") {
					if (row.expanded) {
						expandedGroups.delete(row.groupIndex);
					} else {
						expandedGroups.add(row.groupIndex);
					}
					rerender();
				} else {
					selectActiveStory(row);
				}
				break;
			}

			case "q":
			case "escape": {
				closeViewer();
				break;
			}
		}
	};

	const closeViewer = () => {
		if (closed) {
			return;
		}
		closed = true;
		cleanup();
		const done = resolvePromise;
		resolvePromise = null;
		done?.();
	};

	const cleanup = () => {
		closed = true;
		stopAnimation();
		stdout.off("resize", onResizeRef);
		stdin.removeListener("keypress", onKeypress);
		setRawMode(false);
		stdout.write(ANSI_RESET);
		stdout.write(ANSI_SHOW_CURSOR);
		stdout.write(`${ANSI_CURSOR_HOME}${ANSI_CLEAR_SCREEN}`);
	};

	let resolvePromise: (() => void) | null = null;

	return new Promise((resolve) => {
		resolvePromise = resolve;

		onResizeRef = () => rerender();
		stdout.on("resize", onResizeRef);

		readline.emitKeypressEvents(stdin);
		setRawMode(true);
		stdin.resume();
		stdin.on("keypress", onKeypress);
		stdout.write(ANSI_HIDE_CURSOR);

		startAnimation();
		// Resolve only when explicitly closed via the key handler.
	})();
}
