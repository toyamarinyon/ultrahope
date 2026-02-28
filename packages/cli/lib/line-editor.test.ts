import { describe, expect, it } from "bun:test";
import { parseKey, TextBuffer } from "./line-editor";

describe("TextBuffer", () => {
	it("inserts ascii chars and tracks cursor", () => {
		const buffer = new TextBuffer("");
		buffer.insert("h");
		buffer.insert("i");
		expect(buffer.getText()).toBe("hi");
		expect(buffer.getCursor()).toBe(2);
		buffer.moveLeft();
		buffer.insert("!");
		expect(buffer.getText()).toBe("h!i");
		expect(buffer.getCursor()).toBe(2);
	});

	it("returns display width 2 for CJK character", () => {
		const buffer = new TextBuffer("あ");
		expect(buffer.getDisplayCursor()).toBe(2);
	});

	it("deletes backward at start and forward at end as no-op", () => {
		const buffer = new TextBuffer("x");
		buffer.deleteBackward();
		expect(buffer.getText()).toBe("x");
		buffer.moveToEnd();
		buffer.deleteForward();
		expect(buffer.getText()).toBe("x");
	});

	it("deletes backward word and supports kill/yank round-trip", () => {
		const buffer = new TextBuffer("hello world");
		buffer.moveToEnd();
		buffer.moveWordLeft();
		buffer.deleteBackwardWord();
		expect(buffer.getText()).toBe("hello ");
		expect(buffer.getCursor()).toBe(6);

		buffer.moveToEnd();
		buffer.killToBeginning();
		expect(buffer.getText()).toBe("");
		buffer.moveToEnd();
		buffer.yank();
		expect(buffer.getText()).toBe("hello ");
	});

	it("moves left and right over ascii", () => {
		const buffer = new TextBuffer("abc");
		buffer.moveLeft();
		expect(buffer.getCursor()).toBe(2);
		buffer.moveLeft();
		expect(buffer.getCursor()).toBe(1);
		buffer.moveRight();
		expect(buffer.getCursor()).toBe(2);
	});

	it("moves left and right over emoji grapheme clusters", () => {
		const buffer = new TextBuffer("a👍b");
		buffer.moveToBeginning();
		buffer.moveRight();
		expect(buffer.getCursor()).toBe(1);
		buffer.moveRight();
		expect(buffer.getCursor()).toBe(5);
		buffer.moveRight();
		expect(buffer.getCursor()).toBe(6);
		buffer.moveLeft();
		expect(buffer.getCursor()).toBe(5);
		buffer.moveLeft();
		expect(buffer.getCursor()).toBe(1);
		buffer.moveLeft();
		expect(buffer.getCursor()).toBe(0);
	});

	it("moves left and right over CJK characters", () => {
		const buffer = new TextBuffer("aあb");
		buffer.moveToEnd();
		buffer.moveLeft();
		expect(buffer.getCursor()).toBe(4);
		buffer.moveLeft();
		expect(buffer.getCursor()).toBe(1);
		buffer.moveLeft();
		expect(buffer.getCursor()).toBe(0);
		buffer.moveRight();
		expect(buffer.getCursor()).toBe(1);
		buffer.moveRight();
		expect(buffer.getCursor()).toBe(4);
	});

	it("moves to beginning/end", () => {
		const buffer = new TextBuffer("abc");
		buffer.moveToEnd();
		expect(buffer.getCursor()).toBe(3);
		buffer.moveToBeginning();
		expect(buffer.getCursor()).toBe(0);
	});

	it("moves by word around punctuation separators", () => {
		const buffer = new TextBuffer("hello, world!");
		buffer.moveToEnd();
		buffer.moveWordLeft();
		expect(buffer.getCursor()).toBe(7);
		buffer.moveWordLeft();
		expect(buffer.getCursor()).toBe(0);
		buffer.moveWordRight();
		expect(buffer.getCursor()).toBe(5);
		buffer.moveWordRight();
		expect(buffer.getCursor()).toBe(12);
	});

	it("deletes forward word from punctuation boundaries", () => {
		const buffer = new TextBuffer("hello world");
		buffer.moveWordRight();
		buffer.deleteForwardWord();
		expect(buffer.getText()).toBe(" world");
	});
});

describe("parseKey", () => {
	it('parses "\\x1b[A" as up', () => {
		const events = parseKey(Buffer.from("\x1b[A"));
		expect(events).toEqual([
			{ key: "up", ctrl: false, alt: false, shift: false },
		]);
	});

	it('parses "\\x1b[1;5C" as Ctrl+Right', () => {
		const events = parseKey(Buffer.from("\x1b[1;5C"));
		expect(events).toEqual([
			{ key: "right", ctrl: true, alt: false, shift: false },
		]);
	});

	it("parses C0 control as ctrl char", () => {
		const events = parseKey(Buffer.from("\x01"));
		expect(events).toEqual([
			{ key: "a", ctrl: true, alt: false, shift: false },
		]);
	});

	it('parses "a" as printable char', () => {
		const events = parseKey(Buffer.from("a"));
		expect(events).toEqual([
			{ key: "a", ctrl: false, alt: false, shift: false },
		]);
	});

	it("parses CJK character", () => {
		const events = parseKey(Buffer.from("あ"));
		expect(events).toEqual([
			{ key: "あ", ctrl: false, alt: false, shift: false },
		]);
	});
});
