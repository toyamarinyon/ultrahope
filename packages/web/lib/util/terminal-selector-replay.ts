import type { CreateCandidates } from "../../../shared/terminal-selector-contract";
import type {
	TerminalStreamReplayCapture,
	TerminalStreamReplayRun,
} from "../../../shared/terminal-stream-replay";

function waitForDelay(ms: number, signal: AbortSignal): Promise<void> {
	if (ms <= 0) {
		return Promise.resolve();
	}

	return new Promise<void>((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timer);
			reject(new DOMException("Operation cancelled", "AbortError"));
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

export function pickLatestReplayRun(
	capture: TerminalStreamReplayCapture,
): TerminalStreamReplayRun | null {
	if (capture.runs.length === 0) {
		return null;
	}
	return capture.runs[capture.runs.length - 1];
}

export function extractReplayModels(run: TerminalStreamReplayRun): string[] {
	const seen = new Set<string>();
	for (const event of run.events) {
		if (!event.candidate.model) {
			continue;
		}
		seen.add(event.candidate.model);
	}
	return [...seen];
}

export function createCandidatesFromReplayRun(options: {
	run: TerminalStreamReplayRun;
}): CreateCandidates {
	const { run } = options;

	return (signal: AbortSignal) => {
		return {
			[Symbol.asyncIterator]: async function* () {
				let previousAtMs = 0;
				for (const event of run.events) {
					const delayMs = Math.max(0, event.atMs - previousAtMs);
					previousAtMs = event.atMs;
					await waitForDelay(delayMs, signal);
					yield {
						...event.candidate,
					};
				}
			},
		};
	};
}
