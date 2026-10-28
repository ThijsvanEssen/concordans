// Dekking en stand: the colleges appear as soon as /api/stats/coverage is there, whatever
// /api/stats does, and each block fails and asks again by itself.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';

const stats = vi.fn();
const coverage = vi.fn();
vi.mock('$lib/api/stats', () => ({ getStats: stats, getCoverage: coverage }));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('Bronnen, Dekking en stand', () => {
	it('shows the colleges while the numbers per collection fail, and retries only that block', async () => {
		stats.mockRejectedValueOnce(new DOMException('', 'TimeoutError'));
		coverage.mockResolvedValue({
			tiers: [{ tier: 'hoge_raad', count: 5, first_date: '1841-01-01', last_date: '2026-10-27' }]
		});
		const { default: Page } = await import('./+page.svelte');
		render(Page);
		await waitFor(() =>
			expect(screen.getByRole('alert').textContent).toMatch(/De dekking kon niet op tijd/)
		);
		expect(screen.getByText('Hoge Raad')).toBeTruthy();
		expect(screen.getAllByRole('alert')).toHaveLength(1);

		stats.mockResolvedValueOnce({ nodes: {}, data_as_of: {} });
		screen.getByRole('button', { name: 'Opnieuw' }).click();
		await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
		expect(stats).toHaveBeenCalledTimes(2);
		expect(coverage).toHaveBeenCalledTimes(1);
	});
});
