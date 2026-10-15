// The search dialog: its field once it opens, the search a chunk of its own
// (SearchOverlay.missing.dom.test.ts: a chunk that does not come).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import SearchOverlay from './SearchOverlay.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('SearchOverlay', () => {
	it('shows nothing while closed, and the search field once open', async () => {
		const { rerender } = render(SearchOverlay, { open: false, onClose: () => {} });
		expect(screen.queryByRole('dialog')).toBeNull();
		await rerender({ open: true, onClose: () => {} });
		await settle();
		expect(screen.getByRole('dialog', { name: 'Zoeken' })).toBeTruthy();
		expect(await screen.findByRole('combobox', {}, { timeout: 10_000 })).toBeTruthy();
	});
});
