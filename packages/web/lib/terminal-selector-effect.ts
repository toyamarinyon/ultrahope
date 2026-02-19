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

				const pending = new Map<number, Promise<TaskResult>>();
				for (let index = 0; index < tasks.length; index++) {
					pending.set(index, runTask(tasks[index], index, signal));
				}

				const abortPromise = new Promise<{ kind: "abort" }>((resolve) => {
					if (signal.aborted) {
						resolve({ kind: "abort" });
						return;
					}
					signal.addEventListener(
						"abort",
						() => {
							resolve({ kind: "abort" });
						},
						{ once: true },
					);
				});

				try {
					while (pending.size > 0) {
						const winner = await Promise.race([
							...pending.values(),
							abortPromise,
						]);

						if (winner.kind === "abort") {
							return;
						}

						if ((winner as ErrorResult).kind === "error") {
							pending.delete((winner as ErrorResult).index);
							continue;
						}

						const { index, candidate } = winner as CandidateResult;
						pending.delete(index);
						if (signal.aborted) {
							return;
						}
						yield candidate;
					}
				} finally {
					for (const item of pending.values()) {
						item.catch(() => undefined);
					}
				}
			},
		};
	};
}
