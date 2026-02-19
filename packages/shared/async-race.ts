export type RaceErrorAction = "continue" | "throw";

export type RaceErrorPolicy = (
	index: number,
	error: unknown,
) => RaceErrorAction;

export interface RaceOptions<T> {
	iterators: AsyncIterator<T>[];
	signal?: AbortSignal;
	onError?: RaceErrorPolicy;
}

type RaceFulfilled<T> =
	| { kind: "result"; index: number; result: IteratorResult<T> }
	| { kind: "error"; index: number; error: unknown };

export interface RaceYield<T> {
	index: number;
	result: IteratorResult<T>;
}

export async function* raceAsyncIterators<T>({
	iterators,
	signal,
	onError,
}: RaceOptions<T>): AsyncGenerator<RaceYield<T>> {
	if (iterators.length === 0) {
		return;
	}

	if (signal?.aborted) {
		return;
	}

	const abortPromise: Promise<null> | null = signal
		? new Promise((resolve) => {
				signal.addEventListener("abort", () => resolve(null), { once: true });
			})
		: null;

	const pending = new Map<number, Promise<RaceFulfilled<T>>>();
	const startNext = (index: number): void => {
		const iterator = iterators[index];
		if (!iterator) {
			return;
		}
		pending.set(
			index,
			iterator.next().then(
				(result) => ({ kind: "result", index, result }),
				(error) => ({ kind: "error", index, error }),
			),
		);
	};

	const throwOrContinue = (error: unknown, index: number): void => {
		if (!onError) {
			throw error;
		}
		const decision = onError(index, error);
		if (decision === "throw") {
			throw error;
		}
	};

	try {
		for (let index = 0; index < iterators.length; index++) {
			startNext(index);
		}

		while (pending.size > 0) {
			const winner = abortPromise
				? await Promise.race([
						...pending.values(),
						abortPromise.then(() => null),
					])
				: await Promise.race([...pending.values()]);

			if (winner === null) {
				return;
			}

			const { index } = winner;
			pending.delete(index);

			if (winner.kind === "error") {
				throwOrContinue(winner.error, winner.index);
				continue;
			}

			const { result } = winner;
			if (!result.done) {
				startNext(index);
				yield { index, result };
			}
		}
	} finally {
		for (const iterator of iterators) {
			try {
				await iterator.return?.();
			} catch {}
		}
		for (const promise of pending.values()) {
			promise.catch(() => undefined);
		}
	}
}
