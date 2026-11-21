// When the page has asked the API all it will ask for now: work that is not for the reader
// (the chunk of the canvas) waits for it, so the first calls and the scripts that handle
// their answers do not share the line with it.

import { whenIdle } from '$lib/util/idle';

let inFlight = 0;
const watchers = new Set<() => void>();

/** Counts a request while it is under way; the answer is the request itself. */
export function tracked<T>(request: Promise<T>): Promise<T> {
	inFlight++;
	const done = () => {
		inFlight--;
		if (inFlight === 0) for (const w of watchers) w();
	};
	Promise.resolve(request).then(done, done);
	return request;
}

/**
 * Runs `fn` once no request has been under way for `settle` ms (the calls of a page come in
 * waves: the next one starts when the answer of the last is drawn). The answer cancels it.
 */
export function whenApiQuiet(fn: () => void, settle = 600): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const arm = () => {
		clearTimeout(timer);
		timer = inFlight === 0 ? setTimeout(fire, settle) : undefined;
	};
	const fire = () => {
		if (inFlight > 0) return;
		watchers.delete(arm);
		fn();
	};
	watchers.add(arm);
	arm();
	return () => {
		clearTimeout(timer);
		watchers.delete(arm);
	};
}

type Connection = { saveData?: boolean; effectiveType?: string };

/** A line where a chunk nobody asked for costs more than it gives: Data Saver, or 3g or slower. */
export function sparingLine(
	connection: Connection | undefined = (navigator as { connection?: Connection }).connection
): boolean {
	if (!connection) return false;
	return !!connection.saveData || ['slow-2g', '2g', '3g'].includes(connection.effectiveType ?? '');
}

/**
 * Asks for what the reader does not need yet (`ask`) once the page has had its answers and the
 * browser is idle; not at all on a sparing line. The answer cancels it.
 */
export function preloadAfterAnswers(ask: () => void): () => void {
	if (sparingLine()) return () => {};
	let cancelIdle = () => {};
	const cancelQuiet = whenApiQuiet(() => {
		cancelIdle = whenIdle(ask, { timeout: 5000, fallback: 3000 });
	});
	return () => (cancelQuiet(), cancelIdle());
}
