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

/** The API is read-only: every route is a GET, answered without a key. */
export const api = createClient<paths>({ baseUrl: API_BASE_URL, fetch: withTimeout });

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
