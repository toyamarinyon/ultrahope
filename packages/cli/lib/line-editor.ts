import stringWidth from "string-width";

const WORD_SEPARATORS = "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?";
const DEFAULT_ESCAPE_TIMEOUT_MS = 30;
const GRAPHEME_SEGMENTER = new Intl.Segmenter("en", {
	granularity: "grapheme",
});

export interface KeyEvent {
	key: string;
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
}

export interface EditLineOptions {
	input: NodeJS.ReadableStream;
	output: NodeJS.WritableStream;
	prefix?: string;
	initialValue?: string;
	helpText?: string;
	helpSpacing?: number;
	escapeTimeout?: number;
}

function isPrintableChar(char: string): boolean {
	const codePoint = char.codePointAt(0);
	if (codePoint === undefined) return false;
	if (codePoint <= 0x1f || codePoint === 0x7f || codePoint === 0x1b)
		return false;
	return true;
}

function firstGraphemeFromBuffer(
	buffer: Buffer,
	offset: number,
): { char: string; byteLength: number } | null {
	const remaining = buffer.subarray(offset).toString("utf8");
	const [char] = Array.from(remaining);
	if (!char) return null;
	return { char, byteLength: Buffer.from(char).length };
}

function parseEscKey(
	buffer: Buffer,
	start: number,
): { consumed: number; event: KeyEvent } | null | "incomplete" {
	if (start + 1 >= buffer.length) return "incomplete";

	if (buffer[start + 1] === 0x5b) {
		if (start + 2 >= buffer.length) return "incomplete";
		const suffix = buffer.subarray(start + 2).toString("ascii");

		if (suffix.startsWith("A"))
			return {
				consumed: 3,
				event: { key: "up", ctrl: false, alt: false, shift: false },
			};
		if (suffix.startsWith("B"))
			return {
				consumed: 3,
				event: { key: "down", ctrl: false, alt: false, shift: false },
			};
		if (suffix.startsWith("C"))
			return {
				consumed: 3,
				event: { key: "right", ctrl: false, alt: false, shift: false },
			};
		if (suffix.startsWith("D"))
			return {
				consumed: 3,
				event: { key: "left", ctrl: false, alt: false, shift: false },
			};
		if (suffix.startsWith("H"))
			return {
				consumed: 3,
				event: { key: "home", ctrl: false, alt: false, shift: false },
			};
		if (suffix.startsWith("F"))
			return {
				consumed: 3,
				event: { key: "end", ctrl: false, alt: false, shift: false },
			};

		if (suffix.startsWith("3~"))
			return {
				consumed: 4,
				event: { key: "delete", ctrl: false, alt: false, shift: false },
			};

		if (suffix.startsWith("1;5C"))
			return {
				consumed: 6,
				event: { key: "right", ctrl: true, alt: false, shift: false },
			};
		if (suffix.startsWith("1;5D"))
			return {
				consumed: 6,
				event: { key: "left", ctrl: true, alt: false, shift: false },
			};
		if (suffix.startsWith("1;3C"))
			return {
				consumed: 6,
				event: { key: "right", ctrl: false, alt: true, shift: false },
			};
		if (suffix.startsWith("1;3D"))
			return {
				consumed: 6,
				event: { key: "left", ctrl: false, alt: true, shift: false },
			};

		return null;
	}

	if (buffer[start + 1] === 0x7f) {
		return {
			consumed: 2,
			event: {
				key: "backspace",
				ctrl: false,
				alt: true,
				shift: false,
			},
		};
	}

	const altChar = firstGraphemeFromBuffer(buffer, start + 1);
	if (!altChar) return "incomplete";
	if (!isPrintableChar(altChar.char)) return null;
	return {
		consumed: 1 + altChar.byteLength,
		event: {
			key: altChar.char,
			ctrl: false,
			alt: true,
			shift: false,
		},
	};
}

function isSeparator(char: string): boolean {
	if (!char) return false;
	return /\s/.test(char) || WORD_SEPARATORS.includes(char);
}

function isWordChar(char: string): boolean {
	return !!char && !isSeparator(char);
}

function graphemeBoundaries(text: string): number[] {
	const boundaries = [0];
	for (const segment of GRAPHEME_SEGMENTER.segment(text)) {
		if (segment.index > 0) {
			boundaries.push(segment.index);
		}
	}
	boundaries.push(text.length);
	return [...new Set(boundaries)].sort((a, b) => a - b);
}

function nextGraphemeBoundary(text: string, cursor: number): number {
	const boundaries = graphemeBoundaries(text);
	for (const boundary of boundaries) {
		if (boundary > cursor) return boundary;
	}
	return text.length;
}

function prevGraphemeBoundary(text: string, cursor: number): number {
	const boundaries = graphemeBoundaries(text);
	for (let index = boundaries.length - 1; index >= 0; index--) {
		if (boundaries[index] < cursor) return boundaries[index];
	}
	return 0;
}

function clampCursorToBoundary(text: string, offset: number): number {
	if (offset <= 0) return 0;
	if (offset >= text.length) return text.length;

	const boundaries = graphemeBoundaries(text);
	for (let index = boundaries.length - 1; index >= 0; index--) {
		if (boundaries[index] <= offset) return boundaries[index];
	}
	return 0;
}

export class TextBuffer {
	private text: string;
	private cursor: number;
	private killBuffer: string;

	constructor(initial: string) {
		this.text = initial;
		this.cursor = initial.length;
		this.killBuffer = "";
	}

	getText(): string {
		return this.text;
	}

	getCursor(): number {
		return this.cursor;
	}

	getDisplayCursor(): number {
		return stringWidth(this.text.slice(0, this.cursor));
	}

	insert(char: string): void {
		this.text = `${this.text.slice(0, this.cursor)}${char}${this.text.slice(this.cursor)}`;
		this.cursor = clampCursorToBoundary(this.text, this.cursor + char.length);
	}

	deleteBackward(): void {
		if (this.cursor === 0) return;
		const deleteStart = prevGraphemeBoundary(this.text, this.cursor);
		this.text = `${this.text.slice(0, deleteStart)}${this.text.slice(this.cursor)}`;
		this.cursor = deleteStart;
	}

	deleteForward(): void {
		if (this.cursor === this.text.length) return;
		const deleteEnd = nextGraphemeBoundary(this.text, this.cursor);
		this.text = `${this.text.slice(0, this.cursor)}${this.text.slice(deleteEnd)}`;
	}

	private previousGrapheme(cursor: number): string {
		const start = prevGraphemeBoundary(this.text, cursor);
		return this.text.slice(start, cursor);
	}

	private nextGrapheme(cursor: number): string {
		const end = nextGraphemeBoundary(this.text, cursor);
		return this.text.slice(cursor, end);
	}

	deleteBackwardWord(): void {
		if (this.cursor === 0) return;

		let deleteStart = this.cursor;
		while (deleteStart > 0 && isSeparator(this.previousGrapheme(deleteStart))) {
			deleteStart = prevGraphemeBoundary(this.text, deleteStart);
		}
		while (deleteStart > 0 && isWordChar(this.previousGrapheme(deleteStart))) {
			deleteStart = prevGraphemeBoundary(this.text, deleteStart);
		}
		if (deleteStart === this.cursor) return;

		this.killBuffer = this.text.slice(deleteStart, this.cursor);
		this.text = `${this.text.slice(0, deleteStart)}${this.text.slice(this.cursor)}`;
		this.cursor = deleteStart;
	}

	deleteForwardWord(): void {
		if (this.cursor === this.text.length) return;

		let deleteEnd = this.cursor;
		while (
			deleteEnd < this.text.length &&
			isSeparator(this.nextGrapheme(deleteEnd))
		) {
			deleteEnd = nextGraphemeBoundary(this.text, deleteEnd);
		}
		while (
			deleteEnd < this.text.length &&
			isWordChar(this.nextGrapheme(deleteEnd))
		) {
			deleteEnd = nextGraphemeBoundary(this.text, deleteEnd);
		}
		if (deleteEnd === this.cursor) return;

		this.killBuffer = this.text.slice(this.cursor, deleteEnd);
		this.text = `${this.text.slice(0, this.cursor)}${this.text.slice(deleteEnd)}`;
	}

	killToEnd(): void {
		if (this.cursor === this.text.length) return;
		this.killBuffer = this.text.slice(this.cursor);
		this.text = this.text.slice(0, this.cursor);
	}

	killToBeginning(): void {
		if (this.cursor === 0) return;
		this.killBuffer = this.text.slice(0, this.cursor);
		this.text = this.text.slice(this.cursor);
		this.cursor = 0;
	}

	yank(): void {
		if (!this.killBuffer) return;
		this.insert(this.killBuffer);
	}

	moveLeft(): void {
		this.cursor = prevGraphemeBoundary(this.text, this.cursor);
	}

	moveRight(): void {
		this.cursor = nextGraphemeBoundary(this.text, this.cursor);
	}

	moveToBeginning(): void {
		this.cursor = 0;
	}

	moveToEnd(): void {
		this.cursor = this.text.length;
	}

	moveWordLeft(): void {
		let target = this.cursor;
		while (target > 0 && isSeparator(this.previousGrapheme(target))) {
			target = prevGraphemeBoundary(this.text, target);
		}
		while (target > 0 && isWordChar(this.previousGrapheme(target))) {
			target = prevGraphemeBoundary(this.text, target);
		}
		this.cursor = target;
	}

	moveWordRight(): void {
		let target = this.cursor;
		while (
			target < this.text.length &&
			isSeparator(this.nextGrapheme(target))
		) {
			target = nextGraphemeBoundary(this.text, target);
		}
		while (target < this.text.length && isWordChar(this.nextGrapheme(target))) {
			target = nextGraphemeBoundary(this.text, target);
		}
		this.cursor = target;
	}
}

export function parseKey(buf: Buffer): KeyEvent[] {
	const events: KeyEvent[] = [];

	for (let i = 0; i < buf.length; ) {
		const value = buf[i];
		if (value === undefined) break;

		if (value === 0x1b) {
			const parsed = parseEscKey(buf, i);
			if (parsed === "incomplete") return [];
			if (!parsed) {
				i += 1;
				continue;
			}
			events.push(parsed.event);
			i += parsed.consumed;
			continue;
		}

		if (value >= 0x01 && value <= 0x1a) {
			events.push({
				key: String.fromCharCode(96 + value),
				ctrl: true,
				alt: false,
				shift: false,
			});
			i += 1;
			continue;
		}

		if (value === 0x0d || value === 0x0a) {
			events.push({
				key: "return",
				ctrl: false,
				alt: false,
				shift: false,
			});
			i += 1;
			continue;
		}

		if (value === 0x7f) {
			events.push({
				key: "backspace",
				ctrl: false,
				alt: false,
				shift: false,
			});
			i += 1;
			continue;
		}

		if (value === 0x09) {
			events.push({
				key: "tab",
				ctrl: false,
				alt: false,
				shift: false,
			});
			i += 1;
			continue;
		}

		const decoded = buf.subarray(i).toString("utf8");
		const [char] = Array.from(decoded);
		if (!char || !isPrintableChar(char)) {
			i += 1;
			continue;
		}
		const byteLength = Buffer.from(char).length;
		events.push({
			key: char,
			ctrl: false,
			alt: false,
			shift: false,
		});
		i += byteLength;
	}

	return events;
}

export function renderLine(
	output: NodeJS.WritableStream,
	prefix: string,
	buffer: TextBuffer,
	helpText?: string,
	helpSpacing?: number,
): void {
	const spacing = helpSpacing ?? 0;

	output.write("\r");
	output.write("\x1b[2K");
	output.write(prefix + buffer.getText());

	if (helpText && spacing > 0) {
		const down = Math.max(0, spacing);
		if (down > 0) {
			output.write(`\x1b[${down}B`);
		}
		output.write("\r");
		output.write(helpText);
		if (down > 0) {
			output.write(`\x1b[${down}A`);
		}
	}

	output.write("\r");
	const cursorColumn = stringWidth(prefix) + buffer.getDisplayCursor();
	if (cursorColumn > 0) {
		output.write(`\x1b[${cursorColumn}C`);
	}
}

function setRawModeSafe(stream: NodeJS.ReadableStream, enabled: boolean): void {
	const ttyStream = stream as { setRawMode?: (enabled: boolean) => void };
	if (typeof ttyStream.setRawMode !== "function") {
		if (enabled) {
			throw new Error("Input stream does not support setRawMode");
		}
		return;
	}
	ttyStream.setRawMode(enabled);
}

function bufferForDataChunk(data: string | Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike> {
	if (Buffer.isBuffer(data)) return data;
	return Buffer.from(data, "utf8");
}

export function editLine(options: EditLineOptions): Promise<string | null> {
	const {
		input,
		output,
		prefix = "",
		initialValue = "",
		helpText,
		helpSpacing = 0,
		escapeTimeout = DEFAULT_ESCAPE_TIMEOUT_MS,
	} = options;

	return new Promise<string | null>((resolve, reject) => {
		let done = false;
			let pendingEscape: Buffer<ArrayBufferLike> = Buffer.alloc(0);
		let escapeTimer: ReturnType<typeof setTimeout> | null = null;

		const buffer = new TextBuffer(initialValue);
		const clearTimer = () => {
			if (escapeTimer) {
				clearTimeout(escapeTimer);
				escapeTimer = null;
			}
		};
			const scheduleEscape = () => {
				clearTimer();
				escapeTimer = setTimeout(() => {
					pendingEscape = Buffer.alloc(0);
					applyKeyEvent({
						key: "escape",
						ctrl: false,
						alt: false,
						shift: false,
					});
				}, escapeTimeout);
			};

		const finish = (value: string | null) => {
			if (done) return;
			done = true;

			input.removeListener("data", onData);
			clearTimer();
			setRawModeSafe(input, false);

			output.write("\r");
			output.write("\x1b[2K");
			if (helpText && helpSpacing > 0) {
				output.write(`\x1b[${helpSpacing}B`);
				output.write("\r");
				output.write("\x1b[2K");
				output.write(`\x1b[${helpSpacing}A`);
			}
			output.write("\n");

			resolve(value);
		};

		const applyKeyEvent = (event: KeyEvent) => {
			if (event.key === "return") {
				finish(buffer.getText());
				return;
			}
			if (event.key === "escape" || (event.key === "c" && event.ctrl)) {
				finish(null);
				return;
			}

			switch (event.key) {
				case "backspace":
					if (event.ctrl || event.alt) {
						buffer.deleteBackwardWord();
					} else {
						buffer.deleteBackward();
					}
					break;
				case "delete":
					buffer.deleteForward();
					break;
				case "left":
					if (event.ctrl) {
						buffer.moveWordLeft();
					} else if (event.alt) {
						buffer.moveWordLeft();
					} else {
						buffer.moveLeft();
					}
					break;
				case "right":
					if (event.ctrl) {
						buffer.moveWordRight();
					} else if (event.alt) {
						buffer.moveWordRight();
					} else {
						buffer.moveRight();
					}
					break;
				case "home":
					buffer.moveToBeginning();
					break;
				case "end":
					buffer.moveToEnd();
					break;
				case "h":
					if (event.ctrl) buffer.deleteBackward();
					else buffer.insert(event.key);
					break;
				case "d":
					if (event.ctrl) {
						buffer.deleteForward();
					} else if (event.alt) {
						buffer.deleteForwardWord();
					} else {
						buffer.insert(event.key);
					}
					break;
				case "b":
					if (event.ctrl || event.alt) {
						buffer.moveWordLeft();
					} else {
						buffer.insert(event.key);
					}
					break;
				case "f":
					if (event.ctrl || event.alt) {
						buffer.moveWordRight();
					} else {
						buffer.insert(event.key);
					}
					break;
				case "a":
					if (event.ctrl) {
						buffer.moveToBeginning();
					} else {
						buffer.insert(event.key);
					}
					break;
				case "e":
					if (event.ctrl) {
						buffer.moveToEnd();
					} else {
						buffer.insert(event.key);
					}
					break;
				case "w":
					if (event.ctrl) {
						buffer.deleteBackwardWord();
					} else {
						buffer.insert(event.key);
					}
					break;
				case "k":
					if (event.ctrl) {
						buffer.killToEnd();
					} else {
						buffer.insert(event.key);
					}
					break;
				case "u":
					if (event.ctrl) {
						buffer.killToBeginning();
					} else {
						buffer.insert(event.key);
					}
					break;
				case "y":
					if (event.ctrl) {
						buffer.yank();
					} else {
						buffer.insert(event.key);
					}
					break;
				default:
					if (
						event.key.length === 1 &&
						!event.ctrl &&
						!event.alt &&
						event.key !== "tab"
					) {
						buffer.insert(event.key);
					}
			}

			renderLine(output, prefix, buffer, helpText, helpSpacing);
		};

		const onData = (chunk: string | Buffer) => {
			if (done) return;

			let bytes = bufferForDataChunk(chunk);
			if (pendingEscape.length > 0) {
				bytes = Buffer.concat([pendingEscape, bytes]);
				pendingEscape = Buffer.alloc(0);
			}

			const events = parseKey(bytes);
			if (events.length === 0 && bytes.length > 0 && bytes[0] === 0x1b) {
				pendingEscape = bytes;
				scheduleEscape();
				return;
			}

			clearTimer();
			for (const event of events) {
				applyKeyEvent(event);
				if (done) return;
			}
		};

		try {
			setRawModeSafe(input, true);
			renderLine(output, prefix, buffer, helpText, helpSpacing);
			input.on("data", onData);
		} catch (error) {
			reject(error);
		}
	});
}
