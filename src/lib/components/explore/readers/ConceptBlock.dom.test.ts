import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import CONCEPT from '$lib/fixtures/concept.json';
import type { GraphNode } from '$lib/graph/types';

vi.mock('$lib/api/concepts', () => ({ getConcept: vi.fn(async () => CONCEPT) }));

import ConceptBlock from './ConceptBlock.svelte';

afterEach(cleanup);

const node = { id: 'articles/bwbr0001840_120', key: 'bwbr0001840_120' } as unknown as GraphNode;

async function shown() {
	const view = render(ConceptBlock, { conceptKey: 'toetsing-van-wetten', node });
	await vi.waitFor(() => expect(view.container.querySelector('.articles')).not.toBeNull());
	return view;
}

describe('ConceptBlock', () => {
	it('names the concept in h2 and its lists in h3', async () => {
		const { container } = await shown();
		expect(container.querySelector('h2')?.textContent).toContain('Toetsing van wetten');
		expect([...container.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
			expect.stringContaining('Uitspraken bij deze artikelen'),
			expect.stringContaining('Stukken bij deze artikelen')
		]);
	});

	it('says "5 van N" of each list and links the other articles but not this one', async () => {
		const { container } = await shown();
		expect(container.textContent).toContain('1 van 1.900');
		expect(container.textContent).toContain('1 van 437');
		const links = [...container.querySelectorAll('.articles a')].map((a) => a.textContent);
		expect(links).toEqual(['Art. 93']);
		const dit = container.querySelector('[aria-current="true"]');
		expect(dit?.textContent).toContain('Art. 120');
		expect(dit?.textContent).toContain('dit artikel');
	});

	it('links Uitleg: Rijksoverheid only where the concept has an official page', async () => {
		const { container } = await shown();
		expect(container.querySelector('a[href^="https://www.rijksoverheid.nl"]')?.textContent).toBe(
			'Uitleg: Rijksoverheid'
		);
	});

	it('folds the lists behind a button with aria-expanded', async () => {
		const { container } = await shown();
		const button = container.querySelector<HTMLButtonElement>('.fold-toggle button')!;
		// Closed at first (the design); a choice is kept.
		expect(button.getAttribute('aria-expanded')).toBe('false');
		expect(container.querySelector('.lists')?.classList.contains('is-dicht')).toBe(true);
		await fireEvent.click(button);
		await tick();
		expect(button.getAttribute('aria-expanded')).toBe('true');
		expect(container.querySelector('.lists')?.classList.contains('is-dicht')).toBe(false);
	});
});
