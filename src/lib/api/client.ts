import createClient from 'openapi-fetch';
import { API_BASE_URL } from './base-url';
import type { paths } from './generated/openapi-types';

export const TIMEOUT_MS = 10_000;
/** A search of the slow kinds (judgments, articles and stukken): the API's own deadline. */
export const SLOW_TIMEOUT_MS = 30_000;

/** A loop while developing: more requests than this in this time (below the API's limit). */
export const LUS = { max: 100, ms: 10_000 };

/**
 * While developing: more than `max` requests in `ms` is a loop, not a reader. The next one
 * is refused with an error in the console, so a page that asks without end stops at once
 * instead of running into the API's limit (an effect that reran on its own cleanup, 10 Oct).
 */
export function teller(max = LUS.max, ms = LUS.ms, nu = () => Date.now()) {
	const tijden: number[] = [];
	return (url: string) => {
		const t = nu();
		while (tijden.length && t - tijden[0] > ms) tijden.shift();
		tijden.push(t);
		if (tijden.length <= max) return;
		const fout = `Meer dan ${max} verzoeken aan de API in ${ms / 1000} s: een lus? Geweigerd: ${url}`;
		console.error(fout);
		throw new Error(fout);
	};
}
const bewaak = import.meta.env.DEV && !import.meta.env.VITEST ? teller() : null;

/** A fetch that gives up after `ms`, beside the caller's own abort. */
export const timedFetch = (ms: number) => (request: Request) => (
	bewaak?.(request.url),
	fetch(
		new Request(request, {
			signal: AbortSignal.any([request.signal, AbortSignal.timeout(ms)])
		})
	)
);

/** The API is read-only: every route is a GET, answered without a key. */
export const api = createClient<paths>({ baseUrl: API_BASE_URL, fetch: timedFetch(TIMEOUT_MS) });

/**
 * The same API for what waits as long as the API does: the slow search lanes ("huur" took
 * the judgments 13.8 s on prod, past the 10 s of `api`) and a full node (`getNodeGraph`).
 */
export const slowApi = createClient<paths>({
	baseUrl: API_BASE_URL,
	fetch: timedFetch(SLOW_TIMEOUT_MS)
});

/** `short`: the ordinary 10 s of `api`; `long`: as long as the API does (`slowApi`). */
export type Wait = 'short' | 'long';
export const clientFor = (wait: Wait = 'long') => (wait === 'short' ? api : slowApi);

/** Whether a request gave up on its own time, not on the caller's abort. */
export const isTimeout = (e: unknown) => e instanceof DOMException && e.name === 'TimeoutError';

export class ApiError extends Error {
	constructor(
		readonly status: number,
		url: string,
		/** The id the API gives a 500 (`request_id`), the key to its line in the log. */
		readonly requestId: string | null = null
	) {
		super(`${url} answered ${status}`);
	}
}

/** The `request_id` of an error body, where the API gave one (a 500). */
const requestIdOf = (body: unknown, response: Response): string | null => {
	const id = (body as { request_id?: unknown } | undefined)?.request_id;
	return typeof id === 'string' ? id : response.headers.get('X-Request-ID');
};

const readers = new Set<(data: unknown) => void>();

/**
 * Reads every answer as it arrives (the readable addresses in it, `$lib/bron/leesbaar`);
 * returns how to stop reading.
 */
export function onAnswer(read: (data: unknown) => void): () => void {
	readers.add(read);
	return () => readers.delete(read);
}

/** The body of a successful call; any other status throws an ApiError. */
export async function unwrap<T>(
	call: Promise<{ data?: T; error?: unknown; response: Response }>
): Promise<T> {
	const { data, error, response } = await call;
	if (!response.ok) throw new ApiError(response.status, response.url, requestIdOf(error, response));
	for (const read of readers) read(data);
	return data as T;
}
