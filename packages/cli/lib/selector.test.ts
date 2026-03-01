import { describe, expect, it } from "bun:test";
import { PassThrough } from "node:stream";
import type { CandidateWithModel } from "./selector";
import { selectCandidate } from "./selector";

class FakeInputStream extends PassThrough {
	setRawMode(): void {
		// no-op: terminal mode switching is intentionally ignored in tests.
	}
}

function fakeCandidates(
	items: CandidateWithModel[],
): (signal: AbortSignal) => AsyncIterable<CandidateWithModel> {
	return (_signal: AbortSignal) => ({
		async *[Symbol.asyncIterator]() {
			for (const item of items) {
				yield item;
			}
		},
	});
}

const TWO_CANDIDATES: CandidateWithModel[] = [
	{ content: "feat: add feature", slotId: "slot-0" },
	{ content: "fix: fix bug", slotId: "slot-1" },
];

function waitForGeneration(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("selectCandidate", () => {
	it("confirms the first candidate on Enter", async () => {
		const input = new FakeInputStream();
		const output = new PassThrough();

		const result = selectCandidate({
			createCandidates: fakeCandidates(TWO_CANDIDATES),
			maxSlots: 2,
			io: { input, output },
		});

		await waitForGeneration();
		input.write("\r");

		const value = await result;
		expect(value.action).toBe("confirm");
		expect(value.selected).toBe("feat: add feature");
		expect(value.selectedIndex).toBe(0);
	});

	it("navigates down with j and confirms second candidate", async () => {
		const input = new FakeInputStream();
		const output = new PassThrough();

		const result = selectCandidate({
			createCandidates: fakeCandidates(TWO_CANDIDATES),
			maxSlots: 2,
			io: { input, output },
		});

		await waitForGeneration();
		input.write("j");
		input.write("\r");

		const value = await result;
		expect(value.action).toBe("confirm");
		expect(value.selected).toBe("fix: fix bug");
		expect(value.selectedIndex).toBe(1);
	});

	it("navigates with arrow keys", async () => {
		const input = new FakeInputStream();
		const output = new PassThrough();

		const result = selectCandidate({
			createCandidates: fakeCandidates(TWO_CANDIDATES),
			maxSlots: 2,
			io: { input, output },
		});

		await waitForGeneration();
		input.write("\x1b[B"); // Down arrow
		input.write("\r");

		const value = await result;
		expect(value.action).toBe("confirm");
		expect(value.selectedIndex).toBe(1);
	});

	it("aborts on q", async () => {
		const input = new FakeInputStream();
		const output = new PassThrough();

		const result = selectCandidate({
			createCandidates: fakeCandidates(TWO_CANDIDATES),
			maxSlots: 2,
			io: { input, output },
		});

		await waitForGeneration();
		input.write("q");

		const value = await result;
		expect(value.action).toBe("abort");
		expect(value.abortReason).toBe("exit");
	});

	it("selects candidate by number key", async () => {
		const input = new FakeInputStream();
		const output = new PassThrough();

		const result = selectCandidate({
			createCandidates: fakeCandidates(TWO_CANDIDATES),
			maxSlots: 2,
			io: { input, output },
		});

		await waitForGeneration();
		input.write("2");
		input.write("\r");

		const value = await result;
		expect(value.action).toBe("confirm");
		expect(value.selected).toBe("fix: fix bug");
		expect(value.selectedIndex).toBe(1);
	});

	it("aborts on Ctrl+C", async () => {
		const input = new FakeInputStream();
		const output = new PassThrough();

		const result = selectCandidate({
			createCandidates: fakeCandidates(TWO_CANDIDATES),
			maxSlots: 2,
			io: { input, output },
		});

		await waitForGeneration();
		input.write("\x03"); // Ctrl+C

		const value = await result;
		expect(value.action).toBe("abort");
	});

	it("aborts when abortSignal is already aborted", async () => {
		const controller = new AbortController();
		controller.abort();

		const value = await selectCandidate({
			createCandidates: fakeCandidates(TWO_CANDIDATES),
			maxSlots: 2,
			abortSignal: controller.signal,
			io: {
				input: new FakeInputStream(),
				output: new PassThrough(),
			},
		});

		expect(value.action).toBe("abort");
	});

	it("navigate up wraps correctly at boundary", async () => {
		const input = new FakeInputStream();
		const output = new PassThrough();

		const result = selectCandidate({
			createCandidates: fakeCandidates(TWO_CANDIDATES),
			maxSlots: 2,
			io: { input, output },
		});

		await waitForGeneration();
		// Already at index 0, press k (up) — should stay at 0
		input.write("k");
		input.write("\r");

		const value = await result;
		expect(value.action).toBe("confirm");
		expect(value.selectedIndex).toBe(0);
	});
});
