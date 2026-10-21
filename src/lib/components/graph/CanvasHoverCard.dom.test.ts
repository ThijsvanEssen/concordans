// The card on the canvas asks the text of an article; a text that does not come says so in
// the card with Opnieuw, which asks it again (A121).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import type { GraphNode } from '$lib/graph/types';
import CanvasHoverCard from './CanvasHoverCard.svelte';

const detail = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/articles', () => ({ getArticleDetail: detail }));

const node: GraphNode = {
	id: 'articles/bwbr0005289_6_162',
	collection: 'articles',
	key: 'bwbr0005289_6_162',
	drawClass: 'article',
	label: 'Art. 6:162 BW',
	raw: {
		id: 'articles/bwbr0005289_6_162',
		key: 'bwbr0005289_6_162',
		collection: 'articles',
		type: 'article',
		display_name: 'Art. 6:162 BW',
		labels: [],
		path: null,
		props: { bwb_id: 'BWBR0005289', article_number: '6:162' }
	}
};

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('CanvasHoverCard', () => {
	it('says a text that did not come, and Opnieuw shows it', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		detail.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce({
			article: { text: 'Hij die jegens een ander een onrechtmatige daad pleegt' }
		});
		render(CanvasHoverCard, { node, onOpen: () => {} });
		await settle();
		expect(screen.getByRole('alert').textContent).toContain('De tekst kon niet worden geladen.');

		await fireEvent.click(screen.getByRole('button', { name: 'Opnieuw' }));
		await settle();
		expect(screen.queryByRole('alert')).toBeNull();
		expect(document.body.textContent).toContain('onrechtmatige daad');
		expect(detail).toHaveBeenCalledTimes(2);
	});
});
