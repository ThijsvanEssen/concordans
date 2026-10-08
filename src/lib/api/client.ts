import createClient from 'openapi-fetch';
import { API_BASE_URL } from './base-url';
import type { paths } from './generated/openapi-types';

export const TIMEOUT_MS = 10_000;
/** A search of the slow kinds (judgments, articles and stukken): the API's own deadline. */
export const SEARCH_TIMEOUT_MS = 30_000;

/** A fetch that gives up after `ms`, beside the caller's own abort. */
export const timedFetch = (ms: number) => (request: Request) =>
	fetch(
		new Request(request, {
			signal: AbortSignal.any([request.signal, AbortSignal.timeout(ms)])
		})
	);

/** The API is read-only: every route is a GET, answered without a key. */
export const api = createClient<paths>({ baseUrl: API_BASE_URL, fetch: timedFetch(TIMEOUT_MS) });

/**
 * The same API for the slow search lanes: they wait as long as the API does ("huur" took the
 * judgments 13.8 s on prod, past the 10 s of `api`).
 */
export const zoekApi = createClient<paths>({
	baseUrl: API_BASE_URL,
	fetch: timedFetch(SEARCH_TIMEOUT_MS)
});

/** Whether a request gave up on its own time, not on the caller's abort. */
export const isTimeout = (e: unknown) => e instanceof DOMException && e.name === 'TimeoutError';

export class ApiError extends Error {
	constructor(
		readonly status: number,
		url: string
	) {
		super(`${url} answered ${status}`);
	}
}

/** The body of a successful call; any other status throws an ApiError. */
export async function unwrap<T>(call: Promise<{ data?: T; response: Response }>): Promise<T> {
	const { data, response } = await call;
	if (!response.ok) throw new ApiError(response.status, response.url);
	return data as T;
}
