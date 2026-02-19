import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CandidateWithModel } from "../../shared/terminal-selector-contract";
import type {
	TerminalStreamReplayCapture,
	TerminalStreamReplayRun,
} from "../../shared/terminal-stream-replay";

interface StreamCaptureOptions {
	path?: string;
	command: string;
	revision: string;
}

interface ActiveRun {
	run: TerminalStreamReplayRun;
	startedAtMs: number;
}

export interface StreamCaptureRecorder {
	readonly enabled: boolean;
	startRun: () => number;
	recordCandidate: (runId: number, candidate: CandidateWithModel) => void;
	finishRun: (runId: number) => void;
	flush: () => string | null;
}

const noopRecorder: StreamCaptureRecorder = {
	enabled: false,
	startRun: () => 0,
	recordCandidate: () => {},
	finishRun: () => {},
	flush: () => null,
};

function cloneCandidate(candidate: CandidateWithModel): CandidateWithModel {
	return {
		content: candidate.content,
		slotId: candidate.slotId,
		model: candidate.model,
		cost: candidate.cost,
		generationId: candidate.generationId,
		quota: candidate.quota,
		isPartial: candidate.isPartial,
		slotIndex: candidate.slotIndex,
	};
}

function toSerializableCapture(
	capture: TerminalStreamReplayCapture,
): TerminalStreamReplayCapture {
	return {
		...capture,
		runs: capture.runs.map((run) => ({
			...run,
			events: run.events.map((event) => ({
				atMs: event.atMs,
				candidate: cloneCandidate(event.candidate),
			})),
		})),
	};
}

export function createStreamCaptureRecorder(
	options: StreamCaptureOptions,
): StreamCaptureRecorder {
	if (!options.path) {
		return noopRecorder;
	}

	const outputPath = resolve(process.cwd(), options.path);
	let runSequence = 0;
	const activeRuns = new Map<number, ActiveRun>();

	const capture: TerminalStreamReplayCapture = {
		version: 1,
		source: "ultrahope-jj-describe",
		capturedAt: new Date().toISOString(),
		runs: [],
	};

	const writeCapture = () => {
		capture.capturedAt = new Date().toISOString();
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(
			outputPath,
			`${JSON.stringify(toSerializableCapture(capture), null, 2)}\n`,
			"utf-8",
		);
	};

	return {
		enabled: true,
		startRun: () => {
			runSequence += 1;
			const startedAtMs = Date.now();
			const run: TerminalStreamReplayRun = {
				id: `run-${runSequence}`,
				command: options.command,
				revision: options.revision,
				startedAt: new Date(startedAtMs).toISOString(),
				events: [],
			};
			capture.runs.push(run);
			activeRuns.set(runSequence, { run, startedAtMs });
			return runSequence;
		},
		recordCandidate: (runId, candidate) => {
			const activeRun = activeRuns.get(runId);
			if (!activeRun) {
				return;
			}

			activeRun.run.events.push({
				atMs: Math.max(0, Date.now() - activeRun.startedAtMs),
				candidate: cloneCandidate(candidate),
			});
		},
		finishRun: (runId) => {
			const activeRun = activeRuns.get(runId);
			if (!activeRun) {
				return;
			}

			activeRun.run.endedAt = new Date().toISOString();
			activeRuns.delete(runId);
			writeCapture();
		},
		flush: () => {
			for (const [runId, activeRun] of activeRuns) {
				activeRun.run.endedAt = new Date().toISOString();
				activeRuns.delete(runId);
			}
			writeCapture();
			return outputPath;
		},
	};
}
