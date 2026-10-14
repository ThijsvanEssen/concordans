// A fake of the API for tests: `api.GET` and `zoekApi.GET` answered per path template, as
// the callers name it ('/api/members/{key}'), through the real `unwrap`. An answer can also
// fail as the network does: a status (`fail`), the client's own time-out (`slow`) or the
// caller's abort (`aborted`). Gone again before the next test (src/lib/test/setup.ts).
import { vi, type MockInstance } from 'vitest';
import { api, zoekApi } from '$lib/api/client';
import type { paths } from '$lib/api/generated/openapi-types';
import { onForget } from '$lib/util/forget';

export type ApiPath = keyof paths;

export type FakeRequest = {
	client: 'api' | 'zoekApi';
	path: ApiPath;
	params: { path?: Record<string, unknown>; query?: Record<string, unknown> };
	signal?: AbortSignal;
};

const FAILURE = Symbol('failure');
type Failure = { [FAILURE]: number | DOMException };

/** The API answers with this status and no data. */
export const fail = (status: number): Failure => ({ [FAILURE]: status });

/** The request runs out of the client's time (`isTimeout`). */
export const slow = (): Failure => ({ [FAILURE]: new DOMException('timed out', 'TimeoutError') });

/** The request is broken off, as a fetch whose signal aborted. */
export const aborted = (): Failure => ({ [FAILURE]: new DOMException('aborted', 'AbortError') });

const isFailure = (answer: unknown): answer is Failure =>
	typeof answer === 'object' && answer !== null && FAILURE in answer;

type Answer = Failure | Record<string, unknown> | unknown[] | string | number | boolean | null;

/** An answer, a failure, or a function of the request that gives either (or a promise of it). */
export type FakeAnswer = Answer | ((request: FakeRequest) => unknown);

const response = (path: string, status: number) =>
	Object.defineProperty(new Response(null, { status }), 'url', { value: path });

const spies: MockInstance[] = [];
onForget(() => spies.splice(0).forEach((spy) => spy.mockRestore()));

/** Answer the API from `routes` until the test ends; the requests are kept in order. */
export function fakeApi(routes: Partial<Record<ApiPath, FakeAnswer>>) {
	const requests: FakeRequest[] = [];
	const get =
		(client: FakeRequest['client']) =>
		async (path: ApiPath, init: Partial<Pick<FakeRequest, 'params' | 'signal'>> = {}) => {
			const request: FakeRequest = { client, path, params: init.params ?? {}, signal: init.signal };
			requests.push(request);
			if (init.signal?.aborted) throw init.signal.reason;
			if (!(path in routes)) throw new Error(`fakeApi: no answer for ${path}`);
			const route = routes[path];
			const answer = await (typeof route === 'function' ? route(request) : route);
			if (!isFailure(answer))
				return { data: answer, error: undefined, response: response(path, 200) };
			const failure = answer[FAILURE];
			if (failure instanceof DOMException) throw failure;
			return { data: undefined, error: { detail: failure }, response: response(path, failure) };
		};
	spies.push(
		vi.spyOn(api, 'GET').mockImplementation(get('api') as never),
		vi.spyOn(zoekApi, 'GET').mockImplementation(get('zoekApi') as never)
	);
	return {
		requests,
		/** The params of each request for `path`, in order. */
		asked: (path: ApiPath) => requests.filter((r) => r.path === path).map((r) => r.params)
	};
}
