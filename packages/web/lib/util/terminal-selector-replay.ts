import type {
	CandidateWithModel,
	CreateCandidates,
} from "../../../shared/terminal-selector-contract";
import type {
	TerminalStreamReplayCapture,
	TerminalStreamReplayGeneration,
	TerminalStreamReplayRun,
} from "../../../shared/terminal-stream-replay";

const MIN_REPLAY_EVENT_DELAY_MS = 10;

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

export function pickLatestReplayGeneration(
	run: TerminalStreamReplayRun,
): TerminalStreamReplayGeneration | null {
	if (run.generations.length === 0) {
		return null;
	}
	return run.generations[run.generations.length - 1];
}

export function extractReplayModels(
	generation: TerminalStreamReplayGeneration,
): string[] {
	if (generation.models.length > 0) {
		return [...generation.models];
	}

	const seen = new Set<string>();
	for (const event of generation.events) {
		if (event.event.type !== "commit-message") {
			continue;
		}
		seen.add(event.model);
	}
	return [...seen];
}

function mapModelSlotIndexes(models: string[]): Map<string, number> {
	return new Map(models.map((model, index) => [model, index]));
}

function getLastCommitMessageEventIndexes(
	generation: TerminalStreamReplayGeneration,
): Map<string, number> {
	const lastIndexes = new Map<string, number>();
	for (let index = 0; index < generation.events.length; index++) {
		const event = generation.events[index];
		if (event.event.type !== "commit-message") {
			continue;
		}
		lastIndexes.set(event.model, index);
	}
	return lastIndexes;
}

export function createCandidatesFromReplayGeneration(options: {
	generation: TerminalStreamReplayGeneration;
	models: string[];
}): CreateCandidates {
	const { generation, models } = options;
	const modelSlotIndexes = mapModelSlotIndexes(models);
	const lastIndexes = getLastCommitMessageEventIndexes(generation);

	return (signal: AbortSignal) => {
		return {
			[Symbol.asyncIterator]: async function* () {
				let previousAtMs = 0;
				for (let index = 0; index < generation.events.length; index++) {
					const event = generation.events[index];
					const delayMs = Math.max(
						MIN_REPLAY_EVENT_DELAY_MS,
						Math.max(0, event.atMs - previousAtMs),
					);
					previousAtMs = event.atMs;
					await waitForDelay(delayMs, signal);
					if (event.event.type !== "commit-message") {
						continue;
					}

					const candidate: CandidateWithModel = {
						content: event.event.commitMessage,
						slotId: event.model,
						model: event.model,
						slotIndex: modelSlotIndexes.get(event.model),
						isPartial: lastIndexes.get(event.model) !== index,
					};
					yield candidate;
				}
			},
		};
	};
}
