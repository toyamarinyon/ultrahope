import { raceAsyncIterators } from "../../shared/async-race";
import type {
	CandidateWithModel,
	CreateCandidates,
} from "../../shared/terminal-selector-contract";

export interface EffectCandidateTask {
	slotId: string;
	slotIndex: number;
	model?: string;
	run: (signal: AbortSignal) => Promise<CandidateWithModel>;
}

interface CandidateResult {
	kind: "candidate";
	index: number;
	candidate: CandidateWithModel;
}

interface AbortResult {
	kind: "abort";
}

interface ErrorResult {
	kind: "error";
	index: number;
	error: unknown;
}

type TaskResult = CandidateResult | AbortResult | ErrorResult;

export interface CreateCandidatesFromTasksOptions {
	tasks: EffectCandidateTask[];
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

const createTaskIterator = (
	task: EffectCandidateTask,
	index: number,
	signal: AbortSignal,
): AsyncIterator<TaskResult> => {
	let done = false;

	return {
		next: async () => {
			if (done) {
				return {
					done: true,
					value: undefined,
				};
			}
			done = true;
			return {
				done: false,
				value: await runTask(task, index, signal),
			};
		},
		return: async () => {
			done = true;
			return { done: true, value: undefined };
		},
	};
};

const runTask = (
	task: EffectCandidateTask,
	index: number,
	signal: AbortSignal,
): Promise<TaskResult> => {
	return task
		.run(signal)
		.then((candidate) => ({
			kind: "candidate" as const,
			index,
			candidate,
		}))
		.catch((error): TaskResult => {
			if (isAbortError(error) || signal.aborted) {
				return { kind: "abort" };
			}
			return { kind: "error", index, error };
		});
};

export function createCandidatesFromTasks(
	options: CreateCandidatesFromTasksOptions,
): CreateCandidates {
	const { tasks } = options;

	return (signal: AbortSignal) => {
		return {
			[Symbol.asyncIterator]: async function* () {
				if (tasks.length === 0) {
					return;
				}

				const iterators = tasks.map((task, index) =>
					createTaskIterator(task, index, signal),
				);

				for await (const { result } of raceAsyncIterators({
					iterators,
					signal,
				})) {
					const winner = result.value;
					if (winner.kind === "abort") {
						return;
					}
					if (winner.kind === "error") {
						continue;
					}
					yield winner.candidate;
				}
			},
		};
	};
}
