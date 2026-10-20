// What a failed request means, in one place: every catch in the app asks these instead of
// reading a DOMException or a status of its own. An abort is the caller leaving and says
// nothing; a slow answer is not a broken one; a 404 is "not in the data", not an error.
import { ApiError, isTimeout } from './client';

/** The caller left (a new key, a closed panel): nothing to report or show. */
export const isAborted = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** The answer took too long: our own deadline, or the API or its proxy giving up (503, 504). */
export const isSlow = (e: unknown) =>
	isTimeout(e) || (e instanceof ApiError && (e.status === 503 || e.status === 504));

/**
 * The kenmerk of a failure the API logged (a 500 with its `request_id`): the first eight
 * characters, as its line in the log begins, for a reader to pass on. Null for any other.
 */
export const kenmerkOf = (e: unknown): string | null =>
	e instanceof ApiError && e.status === 500 && e.requestId ? e.requestId.slice(0, 8) : null;

/** The API does not have it: "niet in de gegevens", not a failure. */
export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/** The answer of `call`, or null where the API does not have it; any other failure throws. */
export async function ifExists<T>(call: Promise<T>): Promise<T | null> {
	try {
		return await call;
	} catch (e) {
		if (isNotFound(e)) return null;
		throw e;
	}
}

/**
 * A failure the page goes on without (a name, a colour, a count beside a list): to the
 * console with where it happened, never for an abort. Shown to the reader by the caller,
 * through LoadState, where the failure leaves something out.
 */
export function report(where: string, e: unknown) {
	if (isAborted(e)) return;
	console.warn(`${where}:`, e);
}

/**
 * A request whose answer nobody waits for (a prefetch: the real caller asks again), as a
 * catch handler: `prefetch().catch(ignore('leesbaar'))`. Logged while developing only.
 */
export const ignore = (where: string) => (e: unknown) => {
	if (import.meta.env.DEV && !isAborted(e)) console.debug(`${where} (ignored):`, e);
};
