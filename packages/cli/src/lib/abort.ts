export function mergeAbortSignals(
	...signals: Array<AbortSignal | undefined>
): AbortSignal | undefined {
	const validSignals = signals.filter(
		(signal): signal is AbortSignal => signal !== undefined,
	);

	if (validSignals.length === 0) return undefined;
	if (validSignals.length === 1) return validSignals[0];

	const controller = new AbortController();

	for (const signal of validSignals) {
		if (signal.aborted) {
			controller.abort(signal.reason);
			break;
		}
		signal.addEventListener(
			"abort",
			() => {
				controller.abort(signal.reason);
			},
			{ once: true },
		);
	}

	return controller.signal;
}
