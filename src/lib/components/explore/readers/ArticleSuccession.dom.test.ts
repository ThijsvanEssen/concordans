// The line under the head of an article in a recodification: In het nieuwe recht on the old
// article, Voorheen on the new one, the leden in a fold and the table it rests on.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { open } from '$lib/test/navigation.svelte';
import ArticleSuccession from './ArticleSuccession.svelte';
import { newSv, oldSv } from '$lib/fixtures/succession';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

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
