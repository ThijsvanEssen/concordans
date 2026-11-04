import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/client';
import { handleError, keepFromAddress, moveAddress, onUnhandledRejection } from './hooks.client';
import { kaart } from '$lib/map/map.svelte';
import { reroute } from './hooks';

afterEach(() => vi.restoreAllMocks());

const rejection = (reason: unknown) => {
	const event = { reason, preventDefault: vi.fn() };
	return event as unknown as PromiseRejectionEvent & {
		preventDefault: typeof event.preventDefault;
	};
};

describe('the outer boundary', () => {
	it('reports a promise nobody handled, once, in its own words', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const failure = new ApiError(500, '/api/nodes');
		const event = rejection(failure);
		onUnhandledRejection(event);
		expect(warn).toHaveBeenCalledWith('Onafgehandeld:', failure);
		expect(event.preventDefault).toHaveBeenCalled();
	});

	it('says nothing of an abort: the caller left', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const event = rejection(new DOMException('aborted', 'AbortError'));
		onUnhandledRejection(event);
		expect(warn).not.toHaveBeenCalled();
		expect(event.preventDefault).toHaveBeenCalled();
	});

	it('reports a failure of a page or its load, not a page that does not exist', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const error = new Error('render');
		const args = { event: {}, message: 'Internal Error' } as Parameters<typeof handleError>[0];
		expect(handleError({ ...args, error, status: 500 })).toEqual({ message: 'Internal Error' });
		expect(warn).toHaveBeenCalledWith('Pagina:', error);
		warn.mockClear();
		const notFound = { ...args, error: new Error('Not found'), status: 404, message: 'Not Found' };
		expect(handleError(notFound)).toEqual({ message: 'Not Found' });
		expect(warn).not.toHaveBeenCalled();
		const logged = new ApiError(500, '/api/x', '1a2b3c4d-0000-4000-8000-000000000000');
		expect(handleError({ ...args, error: logged, status: 500 })).toEqual({
			message: 'Internal Error',
			kenmerk: '1a2b3c4d'
		});
	});
});

describe('a bare collection that moved', () => {
	const at = (href: string) => {
		const replaceState = vi.fn();
		moveAddress(
			new URL(href, 'https://concordans.nl') as unknown as Location,
			{ state: null, replaceState } as unknown as History
		);
		return replaceState.mock.calls.map((c) => c[2]);
	};

	it('puts its list in the bar on loading, and leaves any other address alone', () => {
		expect(at('/wetten')).toEqual(['/explore?mode=index&kind=instruments']);
		expect(at('/bundels/k3j2')).toEqual([]);
	});

	it('serves it by its page of now within the app', () => {
		const to = (href: string) =>
			reroute({ url: new URL(href, 'https://concordans.nl'), fetch } as Parameters<
				typeof reroute
			>[0]);
		expect(to('/wetten')).toBe('/explore');
		expect(to('/actueel')).toBeUndefined();
	});
});

describe('a reader opened to keep in a bundel (UX-toets A21 #1, #2)', () => {
	it('keeps there, and takes ?bundel= out of the address on loading', () => {
		const replaceState = vi.fn();
		const keepIn = vi.spyOn(kaart, 'keepIn').mockImplementation(() => {});
		keepFromAddress(
			new URL(
				'https://concordans.nl/wetten/X/artikel/1?bundel=k3j2&lezen=1#lid-2'
			) as unknown as Location,
			{ state: null, replaceState } as unknown as History
		);
		expect(keepIn).toHaveBeenCalledWith('k3j2');
		expect(replaceState.mock.calls[0][2]).toBe(
			'https://concordans.nl/wetten/X/artikel/1?lezen=1#lid-2'
		);
	});
});
