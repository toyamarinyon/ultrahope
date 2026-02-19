import { describe, expect, it } from "bun:test";
import {
	createCommitMessageSanitizer,
	formatSseEvent,
	normalizeCommitMessage,
	trimCommitMessageWrappers,
} from "./stream-service";

describe("stream-service", () => {
	it("normalizes whitespace and trims fence wrappers", () => {
		expect(normalizeCommitMessage("  fix:  format \n file ")).toBe(
			"fix: format file",
		);
		expect(trimCommitMessageWrappers("```text\nhello world\n```")).toBe(
			"hello world",
		);
	});

	it("sanitizes multi-chunk code-fenced messages", () => {
		const sanitizer = createCommitMessageSanitizer();

		const first = sanitizer.push("```feat: test```");
		const second = sanitizer.push(" more");
		const third = sanitizer.finish();

		expect([first, second, third].join("")).toBe("feat: test more");
	});

	it("formats SSE events as text/event-stream payload", () => {
		const payload = formatSseEvent({
			type: "commit-message",
			commitMessage: "done",
		});
		const encoded = new TextDecoder().decode(payload);
		expect(encoded).toBe(
			`data: ${JSON.stringify({ type: "commit-message", commitMessage: "done" })}\n\n`,
		);
	});

	it("formats SSE events with atMs", () => {
		const payload = formatSseEvent({
			atMs: 123,
			type: "commit-message",
			commitMessage: "done",
		});
		const encoded = new TextDecoder().decode(payload);
		expect(encoded).toBe(
			`data: ${JSON.stringify({
				atMs: 123,
				type: "commit-message",
				commitMessage: "done",
			})}\n\n`,
		);
	});
});
