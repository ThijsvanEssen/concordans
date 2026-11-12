// Work that waits until the browser has nothing else to do: a chunk, a list of names, a
// band below the fold (Thijs, 9 Oct: "alles zo lazy mogelijk"). A browser without
// requestIdleCallback (Safari) waits a fixed time instead.

type Wait = {
	/** The longest the browser may hold it back, in ms. */
	timeout?: number;
	/** The wait where the browser cannot say it is idle, in ms. */
	fallback?: number;
};

/** Runs `fn` when the browser is idle; the answer cancels it. */
export function whenIdle(fn: () => void, { timeout = 3000, fallback = timeout / 2 }: Wait = {}) {
	if (typeof requestIdleCallback !== 'function') {
		const t = setTimeout(fn, fallback);
		return () => clearTimeout(t);
	}
	const id = requestIdleCallback(() => fn(), { timeout });
	return () => cancelIdleCallback(id);
}
