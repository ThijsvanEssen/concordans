// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SLOW_AFTER_MS, SLOW_TEXT } from '$lib/util/slow';
import LoadState from './LoadState.svelte';
import SlowLoad from './SlowLoad.svelte';

describe('a load that takes longer than usual (N3)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('tells a screen reader at once and everyone after 3 s, without dots', async () => {
		const { container } = render(SlowLoad, { label: 'Verbindingen laden' });
		const line = () => container.querySelector('[role="status"]')!;
		expect(line().textContent?.trim()).toBe('Verbindingen laden');
		expect(line().className).toBe('sr-only');
		await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS - 1);
		expect(line().className).toBe('sr-only');
		await vi.advanceTimersByTimeAsync(1);
		expect(line().textContent?.trim()).toBe(SLOW_TEXT);
		expect(line().className).toBe('stil');
		expect(SLOW_TEXT).not.toMatch(/…|\.\.\./);
	});

	it('is in every LoadState that loads, line and block', async () => {
		for (const form of ['line', 'block'] as const) {
			const { container, unmount } = render(LoadState, {
				state: { status: 'loading' },
				what: 'De fractie',
				form
			});
			expect(container.textContent).not.toContain(SLOW_TEXT);
			await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS);
			expect(container.textContent).toContain(SLOW_TEXT);
			unmount();
		}
	});
});
