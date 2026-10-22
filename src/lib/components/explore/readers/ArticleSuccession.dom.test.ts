// The line under the head of an article in a recodification: In het nieuwe recht on the old
// article, Voorheen on the new one, the leden in a fold and the table it rests on.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { open } from '$lib/test/navigation.svelte';
import ArticleSuccession from './ArticleSuccession.svelte';
import { newSv, oldSv, outcomeNode } from '$lib/fixtures/succession';
import { outcomesOf } from './succession';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);
// A law the table names by its title: the API knows the Gratiewet, not the Wet X.
vi.mock('$lib/api/search', () => ({
	resolveQuery: async (q: string) => ({
		q,
		kind: q === 'Gratiewet' ? 'instrument' : 'none',
		confidence: q === 'Gratiewet' ? 0.9 : 0,
		match:
			q === 'Gratiewet'
				? { id: 'instruments/bwbr0004257', kind: 'instrument', confidence: 0.9 }
				: null,
		alternatives: []
	})
}));

const sv = { citationTitle: 'Wetboek van Strafvordering', shortTitle: 'Sv' };

beforeEach(() => open('/wetten/BWBR0001903/artikel/126ffa'));

describe('ArticleSuccession', () => {
	it('names the new article with its status, opens it in place and folds out the leden', async () => {
		const { container } = render(ArticleSuccession, {
			successors: [newSv],
			predecessors: [],
			own: sv
		});
		const line = container.querySelector('.succession')!;
		expect(line.textContent).toMatch(/^In het nieuwe recht:\s*art\. 2\.8\.6 Sv \(nieuw\)/);
		expect(line.textContent).toContain('vastgesteld, nog niet in werking');
		expect(line.textContent).not.toContain('·');

		const link = screen.getByRole('link', { name: 'art. 2.8.6 Sv (nieuw)' });
		expect(link.getAttribute('href')).toBe('/explore?focus=articles/stb_2026_56_2_8_6');
		expect(link.getAttribute('target')).toBeNull();

		const table = screen.getByRole('link', { name: /Transponeringstabel/ });
		expect(table.getAttribute('href')).toBe(
			'https://zoek.officielebekendmakingen.nl/blg-1081574.html'
		);

		const fold = screen.getByRole('button', { name: /Leden/ });
		expect(fold.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByText('leden 1, 2 en 3')).toBeNull();
		await fireEvent.click(fold);
		await tick();
		expect(fold.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByText('leden 1, 2 en 3')).toBeTruthy();
		expect(screen.getByText('2.8.6, 2')).toBeTruthy();
	});

	it('puts several new articles each on a line of their own, with their Vergelijk (B30)', () => {
		const second = {
			...newSv,
			article: { ...newSv.article, id: 'articles/stb_2026_56_1_4_1', article_number: '1.4.1' }
		};
		const { container } = render(ArticleSuccession, {
			successors: [newSv, second],
			predecessors: [],
			own: sv
		});
		const items = container.querySelectorAll('.succession__items li');
		expect(items).toHaveLength(2);
		for (const li of items) expect(li.textContent).toMatch(/Vergelijk$/);
		expect(container.querySelector('.succession__line')!.textContent).not.toContain('Vergelijk');
		expect(container.textContent).not.toMatch(/Vergelijk,/);
	});

	it('opens the comparison of the old and the new text in place, and closes it again', async () => {
		render(ArticleSuccession, { successors: [newSv], predecessors: [], own: sv });
		const compare = screen.getByRole('link', { name: 'Vergelijk' });
		const href = new URL(compare.getAttribute('href')!, 'http://localhost');
		expect(href.pathname).toBe('/wetten/BWBR0001903/artikel/126ffa');
		expect(href.searchParams.get('vergelijk')).toBe('articles/stb_2026_56_2_8_6');
		expect(compare.getAttribute('aria-expanded')).toBe('false');

		open('/wetten/BWBR0001903/artikel/126ffa?vergelijk=articles/stb_2026_56_2_8_6&weergave=naast');
		await tick();
		expect(compare.getAttribute('aria-expanded')).toBe('true');
		const closed = new URL(compare.getAttribute('href')!, 'http://localhost');
		expect([...closed.searchParams.keys()]).toEqual([]);
	});

	it('names the old article on the new one, without a status for a law in force', () => {
		const { container } = render(ArticleSuccession, {
			successors: [],
			predecessors: [oldSv],
			own: { citationTitle: sv.citationTitle, shortTitle: null }
		});
		const line = container.querySelector('.succession')!;
		expect(line.textContent).toMatch(/^Voorheen:\s*art\. 126ffa Sv/);
		expect(line.textContent).not.toContain('in werking');
	});

	it('shows nothing when the article has no place in a recodification', () => {
		const { container } = render(ArticleSuccession, {
			successors: [],
			predecessors: [],
			own: sv
		});
		expect(container.querySelector('.succession')).toBeNull();
	});
});

// What became of an old article no new article takes the place of (lawgraph #860).
describe('ArticleSuccession with an outcome', () => {
	const wtw = { citationTitle: 'Waterwet', shortTitle: null };
	const line = (meta: Record<string, unknown>, successors = [] as (typeof newSv)[]) => {
		const { container } = render(ArticleSuccession, {
			successors,
			outcomes: outcomesOf(outcomeNode(meta), successors.length ? sv : wtw),
			own: successors.length ? sv : wtw
		});
		return container.querySelector('.succession')!;
	};

	it.each([
		['vervallen', /^In het nieuwe recht:\s*vervallen bij Omgevingswet\s*Transponeringstabel/],
		['niet_overgenomen', /^In het nieuwe recht:\s*niet overgenomen in Omgevingswet/],
		['blijft_in:Waterwet', /^In het nieuwe recht:\s*blijft in Waterwet\s*Transponeringstabel/],
		['naar:Gratiewet', /^In het nieuwe recht:\s*naar Gratiewet\s*Transponeringstabel/]
	])('says %s in place of a successor', (outcome, text) => {
		const el = line({ outcome, parts: [{ from: '', to: 'x', outcome }] });
		expect(el.textContent).toMatch(text);
		expect(el.textContent).not.toContain('overgebracht');
		expect(el.textContent).not.toContain('·');
		expect(screen.queryByRole('button', { name: /Leden/ })).toBeNull();
	});

	it('opens the new law in place', () => {
		line({ outcome: 'vervallen' });
		expect(screen.getByRole('link', { name: 'Omgevingswet' }).getAttribute('href')).toBe(
			'/wetten/BWBR0037885'
		);
	});

	it('links the other law a part goes to where the API knows it, and keeps an unknown one as text', async () => {
		line({
			outcome: 'naar:Gratiewet',
			parts: [{ from: '', to: 'later', outcome: 'naar:Gratiewet' }]
		});
		await waitFor(() =>
			expect(screen.getByRole('link', { name: 'Gratiewet' }).getAttribute('href')).toBe(
				'/wetten/BWBR0004257'
			)
		);
		expect(screen.queryByRole('link', { name: 'Omgevingswet' })).toBeNull();
	});

	it('says per lid the other law it goes to in the fold-out', async () => {
		const el = line({
			parts: [
				{ from: '1', to: 'vervallen', outcome: 'vervallen' },
				{ from: '2', to: 'later', outcome: 'naar:Wet X' },
				{ from: '3', to: 'later', outcome: 'naar:Gratiewet' }
			]
		});
		await fireEvent.click(screen.getByRole('button', { name: /Leden/ }));
		await tick();
		const parts = el.querySelector('.succession__parts')!;
		expect(parts.textContent).toContain('naar Wet X');
		expect(parts.textContent).toContain('naar Gratiewet');
		await waitFor(() => expect(screen.getByRole('link', { name: 'Gratiewet' })).toBeTruthy());
		expect(screen.queryByRole('link', { name: 'Wet X' })).toBeNull();
	});

	it('says a gap in the quiet line of what the dataset lacks', () => {
		const el = line({ outcome: 'gat', parts: [{ from: '', to: 'B6H3', outcome: 'gat' }] });
		expect(el.querySelector('.dekking')?.textContent).toBe(
			'Geen opvolger in de transponeringstabel'
		);
		expect(el.textContent).not.toContain('Omgevingswet');
	});

	it('puts the outcome of a part beside the successor in the fold-out', async () => {
		const el = line(
			{ outcome: 'vervallen', parts: [{ from: '5', to: 'vervallen', outcome: 'vervallen' }] },
			[newSv]
		);
		expect(el.textContent).toMatch(/^In het nieuwe recht:\s*art\. 2\.8\.6 Sv \(nieuw\)/);
		expect(el.textContent).not.toContain('vervallen bij');
		await fireEvent.click(screen.getByRole('button', { name: /Leden/ }));
		await tick();
		expect(screen.getByText('lid 5')).toBeTruthy();
		expect(screen.getByText('vervallen')).toBeTruthy();
		expect(screen.getAllByRole('link', { name: /Transponeringstabel/ })).toHaveLength(2);
	});
});
