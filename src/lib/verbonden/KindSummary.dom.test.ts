// The summary per soort: the heading's count is a number, with no unit (E8, N3), and Alle N
// stands only where it leads to more than the rows shown (N4).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { GraphNode } from '$lib/graph/types';
import type { Row } from './rows';
import type { Kind } from './summary';
import KindSummary from './KindSummary.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/explore') } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const rij = (n: number): Row => ({
	ref: { collection: 'articles', key: `a${n}` },
	title: `Artikel ${n}`,
	context: null,
	filterGroup: 'wetten',
	relation: 'REFERS_TO',
	direction: 'inbound',
	confidence: 1
});

const soort = (count: number): Kind => ({
	id: 'laws',
	label: 'Wetten',
	count,
	noun: 'wetten en artikelen',
	rows: Array.from({ length: Math.min(count, 3) }, (_, n) => rij(n)),
	groups: [],
	partial: count > 3,
	failed: null,
	collection: 'articles'
});

const selectie = {
	id: 'instruments/x',
	collection: 'instruments',
	key: 'x'
} as unknown as GraphNode;

const toon = (count: number) =>
	render(KindSummary, { kinds: [soort(count)], selection: selectie, onOpen: () => {} });

describe('KindSummary', () => {
	it('counts the laws as a number, without the unit beside it', () => {
		const { container } = toon(469);
		expect(container.querySelector('.kind__count')?.textContent).toBe('469');
	});

	it('leaves Alle N out where nothing is left to open', () => {
		for (const n of [1, 3]) {
			const { unmount } = toon(n);
			expect(screen.queryByRole('button', { name: /^Alle / })).toBeNull();
			unmount();
		}
	});

	it('offers Alle N from the fourth on', () => {
		toon(4);
		expect(screen.getByRole('button', { name: 'Alle 4 wetten en artikelen' })).toBeTruthy();
	});
});
