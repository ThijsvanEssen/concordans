import createClient from 'openapi-fetch';
import { API_BASE_URL } from './base-url';
import type { paths } from './generated/openapi-types';

const TIMEOUT_MS = 10_000;

const withTimeout = (request: Request) =>
	fetch(
		new Request(request, {
			signal: AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)])
		})
	);

/** Reads: straight to the API, which answers them without a key. */
export const api = createClient<paths>({ baseUrl: API_BASE_URL, fetch: withTimeout });

/**
 * Writes: to this app's own server, which holds the API key (routes/proxy).
 * Typed by the same schema, so the paths are the API's paths.
 */
export const writes = createClient<paths>({ baseUrl: '/proxy', fetch: withTimeout });

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
