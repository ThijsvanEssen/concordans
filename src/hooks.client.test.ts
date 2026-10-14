import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/client';
import { handleError, onUnhandledRejection } from './hooks.client';

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
	});
});
