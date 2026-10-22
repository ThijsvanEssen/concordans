import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError } from '$lib/api/client';
import LoadState from './LoadState.svelte';

const limited = (seconds: number) => ({
	status: 'error' as const,
	error: new ApiError(429, '/api/x', null, seconds)
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('LoadState on a 429', () => {
	it('counts down the Retry-After and asks again once by itself', async () => {
		const retry = vi.fn();
		const view = render(LoadState, { state: limited(3), what: 'De wet A', retry });
		expect(screen.getByText('Even te veel verzoeken, opnieuw over 3 s.')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Opnieuw' })).toBeNull();
		await vi.advanceTimersByTimeAsync(1000);
		expect(screen.getByText('Even te veel verzoeken, opnieuw over 2 s.')).toBeTruthy();
		await vi.advanceTimersByTimeAsync(2000);
		expect(retry).toHaveBeenCalledTimes(1);

		// The repeat met the limit again: no second one by itself, Opnieuw once the wait is over.
		await view.rerender({ state: { status: 'loading' } });
		await view.rerender({ state: limited(2) });
		await vi.advanceTimersByTimeAsync(3000);
		await tick();
		expect(retry).toHaveBeenCalledTimes(1);
		expect(screen.getByText('Opnieuw')).toBeTruthy();
	});

	it('asks again by itself only once per subject, also where it comes back new', async () => {
		const retry = vi.fn();
		render(LoadState, { state: limited(1), what: 'De wet B', retry });
		await vi.advanceTimersByTimeAsync(1000);
		expect(retry).toHaveBeenCalledTimes(1);
		cleanup();
		render(LoadState, { state: limited(1), what: 'De wet B', retry });
		await vi.advanceTimersByTimeAsync(2000);
		expect(retry).toHaveBeenCalledTimes(1);
	});
});
