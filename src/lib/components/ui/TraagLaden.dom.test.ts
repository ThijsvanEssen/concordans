// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRAAG_MS, TRAAG_TEKST } from '$lib/util/traag';
import LoadState from './LoadState.svelte';
import TraagLaden from './TraagLaden.svelte';

describe('a load that takes longer than usual (N3)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('tells a screen reader at once and everyone after 3 s, without dots', async () => {
		const { container } = render(TraagLaden, { label: 'Verbindingen laden' });
		const line = () => container.querySelector('[role="status"]')!;
		expect(line().textContent?.trim()).toBe('Verbindingen laden');
		expect(line().className).toBe('sr-only');
		await vi.advanceTimersByTimeAsync(TRAAG_MS - 1);
		expect(line().className).toBe('sr-only');
		await vi.advanceTimersByTimeAsync(1);
		expect(line().textContent?.trim()).toBe(TRAAG_TEKST);
		expect(line().className).toBe('stil');
		expect(TRAAG_TEKST).not.toMatch(/…|\.\.\./);
	});

	it('is in every LoadState that loads, line and block', async () => {
		for (const form of ['line', 'block'] as const) {
			const { container, unmount } = render(LoadState, {
				state: { status: 'loading' },
				what: 'De fractie',
				form
			});
			expect(container.textContent).not.toContain(TRAAG_TEKST);
			await vi.advanceTimersByTimeAsync(TRAAG_MS);
			expect(container.textContent).toContain(TRAAG_TEKST);
			unmount();
		}
	});
});
