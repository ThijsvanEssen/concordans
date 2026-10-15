// A search chunk that does not come (a deploy removed it): said in the dialog, and the page
// loads again for the new release.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import SearchOverlay from './SearchOverlay.svelte';

const reload = vi.hoisted(() => vi.fn());
vi.mock('$lib/util/reload', () => ({ reloadForNewVersion: reload }));
vi.mock('$lib/search/Search.svelte', () => {
	throw new Error('Failed to fetch dynamically imported module');
});

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('SearchOverlay without its chunk', () => {
	it('says so in the dialog', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		render(SearchOverlay, { open: true, onClose: () => {} });
		await settle();
		expect(screen.getByRole('dialog', { name: 'Zoeken' }).textContent).toContain(
			'niet worden geladen'
		);
		expect(reload).toHaveBeenCalled();
	});
});
