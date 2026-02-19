import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
	TerminalStreamReplayCapture,
	TerminalStreamReplayGeneration,
	TerminalStreamReplayRun,
} from "../../shared/terminal-stream-replay";
import type { CommitMessageStreamEvent } from "./api-client";

interface StreamCaptureOptions {
	path?: string;
	command: string;
	args: string[];
	apiPath: string;
}

interface ActiveGeneration {
	generation: TerminalStreamReplayGeneration;
	startedAtMs: number;
}

export interface StreamCaptureRecorder {
	readonly enabled: boolean;
	startGeneration: (meta: { cliSessionId: string; models: string[] }) => number;
	recordEvent: (
		generationId: number,
		record: {
			model: string;
			attempt: number;
			event: CommitMessageStreamEvent;
		},
	) => void;
	finishGeneration: (generationId: number) => void;
	flush: () => string | null;
}

const noopRecorder: StreamCaptureRecorder = {
	enabled: false,
	startGeneration: () => 0,
	recordEvent: () => {},
	finishGeneration: () => {},
	flush: () => null,
};

function sanitizeEvent(
	event: CommitMessageStreamEvent,
): CommitMessageStreamEvent {
	if (event.type === "provider-metadata") {
		return {
			type: "provider-metadata",
			providerMetadata: event.providerMetadata,
		};
	}
	if (event.type === "usage") {
		return {
			type: "usage",
			usage: {
				inputTokens: event.usage.inputTokens,
				outputTokens: event.usage.outputTokens,
				totalTokens: event.usage.totalTokens,
			},
		};
	}
	if (event.type === "commit-message") {
		return {
			type: "commit-message",
			commitMessage: event.commitMessage,
		};
	}
	return {
		type: "error",
		message: event.message,
	};
}

function toSerializableCapture(
	capture: TerminalStreamReplayCapture,
): TerminalStreamReplayCapture {
	return {
		...capture,
		runs: capture.runs.map((run) => ({
			...run,
			args: [...run.args],
			generations: run.generations.map((generation) => ({
				...generation,
				models: [...generation.models],
				events: generation.events.map((event) => ({
					atMs: event.atMs,
					model: event.model,
					attempt: event.attempt,
					event: sanitizeEvent(event.event),
				})),
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
	const runStartedAtMs = Date.now();
	const run: TerminalStreamReplayRun = {
		id: "run-1",
		command: options.command,
		args: options.args,
		apiPath: options.apiPath,
		startedAt: new Date(runStartedAtMs).toISOString(),
		generations: [],
	};

	const capture: TerminalStreamReplayCapture = {
		version: 2,
		source: "ultrahope-commit-message-stream",
		capturedAt: new Date().toISOString(),
		runs: [run],
	};

	let generationSequence = 0;
	let runFinished = false;
	const activeGenerations = new Map<number, ActiveGeneration>();

	const writeCapture = () => {
		capture.capturedAt = new Date().toISOString();
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(
			outputPath,
			`${JSON.stringify(toSerializableCapture(capture), null, 2)}\n`,
			"utf-8",
		);
	};

	const ensureRunFinished = () => {
		if (runFinished) {
			return;
		}
		runFinished = true;
		run.endedAt = new Date().toISOString();
	};

	return {
		enabled: true,
		startGeneration: ({ cliSessionId, models }) => {
			generationSequence += 1;
			const startedAtMs = Date.now();
			const generation: TerminalStreamReplayGeneration = {
				id: `generation-${generationSequence}`,
				cliSessionId,
				models: [...models],
				startedAt: new Date(startedAtMs).toISOString(),
				events: [],
			};
			run.generations.push(generation);
			activeGenerations.set(generationSequence, { generation, startedAtMs });
			return generationSequence;
		},
		recordEvent: (generationId, record) => {
			const activeGeneration = activeGenerations.get(generationId);
			if (!activeGeneration) {
				return;
			}

			const eventAtMs =
				typeof record.event.atMs === "number" &&
				Number.isFinite(record.event.atMs)
					? record.event.atMs
					: Date.now() - activeGeneration.startedAtMs;

			activeGeneration.generation.events.push({
				atMs: Math.max(0, Math.round(eventAtMs)),
				model: record.model,
				attempt: record.attempt,
				event: sanitizeEvent(record.event),
			});
		},
		finishGeneration: (generationId) => {
			const activeGeneration = activeGenerations.get(generationId);
			if (!activeGeneration) {
				return;
			}
			activeGeneration.generation.endedAt = new Date().toISOString();
			activeGenerations.delete(generationId);
			writeCapture();
		},
		flush: () => {
			for (const [generationId, activeGeneration] of activeGenerations) {
				activeGeneration.generation.endedAt = new Date().toISOString();
				activeGenerations.delete(generationId);
			}
			ensureRunFinished();
			writeCapture();
			return outputPath;
		},
	};
}
