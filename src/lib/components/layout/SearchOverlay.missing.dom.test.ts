// A search chunk that does not come (a deploy removed it): said in the dialog, and the page
// loads again for the new release; Opnieuw asks the chunk again.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import SearchOverlay from './SearchOverlay.svelte';

const reload = vi.hoisted(() => vi.fn());
vi.mock('$lib/util/reload', () => ({ reloadForNewVersion: reload }));
/** The chunk fails the first time it is asked, and comes at Opnieuw. */
const asked = vi.hoisted(() => ({ times: 0 }));
vi.mock('$lib/search/Search.svelte', () => {
	if (asked.times++ === 0) throw new Error('Failed to fetch dynamically imported module');
	return { default: (anchor: Comment) => anchor.before(document.createTextNode('zoekveld')) };
});

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('SearchOverlay without its chunk', () => {
	it('says so in the dialog, and asks the chunk again at Opnieuw', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		render(SearchOverlay, { open: true, onClose: () => {} });
		await settle();
		expect(screen.getByRole('dialog', { name: 'Zoeken' }).textContent).toContain(
			'niet worden geladen'
		);
		expect(reload).toHaveBeenCalled();

		await fireEvent.click(screen.getByRole('button', { name: 'Opnieuw' }));
		await settle();
		expect(screen.getByRole('dialog', { name: 'Zoeken' }).textContent).toContain('zoekveld');
	});
});
