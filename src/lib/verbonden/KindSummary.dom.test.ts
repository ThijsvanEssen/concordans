// The summary per soort: the heading's count is a number, with no unit (E8, N3), and Alle N
// stands only where it leads to more than the rows shown (N4).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
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
	settled: true,
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

	it('opened, counts the rows it lists once every page is in (Alle N pages up to N)', () => {
		const kind = soort(10);
		const { container } = render(KindSummary, {
			kinds: [kind],
			selection: selectie,
			onOpen: () => {},
			open: new Set(['laws'])
		});
		expect(container.querySelector('.kind__count')?.textContent).toBe('3');
	});

	it('opened with a page more, keeps the count and offers Meer laden', () => {
		const { container } = render(KindSummary, {
			kinds: [soort(10)],
			selection: selectie,
			onOpen: () => {},
			open: new Set(['laws']),
			hasMore: () => true
		});
		expect(container.querySelector('.kind__count')?.textContent).toBe('10');
		expect(screen.getByText('Volgende 7 wetten en artikelen')).toBeTruthy();
	});

	// A1: the N of "Volgende N" is what the click adds, whatever a page of the API brings.
	it('adds exactly the N it names, whatever size the pages that come in are', async () => {
		let loaded = 300;
		let asking = false;
		const kinds = () => [
			{ ...soort(2000), rows: Array.from({ length: loaded }, (_, n) => rij(n)) }
		];
		const props = {
			kinds: kinds(),
			selection: selectie,
			onOpen: () => {},
			open: new Set(['laws']),
			hasMore: () => true,
			// A page of the API: a different number of judgments each time (77, 82, 301).
			onMore: () => {
				// One ask at a time, as the data source does: a second ask meanwhile is nothing.
				if (asking) return;
				asking = true;
				queueMicrotask(() => {
					asking = false;
					loaded += [77, 82, 301][Math.floor(loaded / 7) % 3];
					void rerender({ ...props, kinds: kinds() });
				});
			}
		};
		const { container, rerender } = render(KindSummary, props);
		const rows = () => container.querySelectorAll('.kind__rows > .kind__row').length;
		expect(rows()).toBe(300);
		const knop = () => screen.getByRole('button', { name: /^Volgende/ });
		for (let i = 1; i <= 3; i++) {
			const n = Number(/Volgende (\d+)/.exec(knop().textContent ?? '')?.[1]);
			const voor = rows();
			await fireEvent.click(knop());
			await vi.waitFor(() => expect(rows() - voor).toBe(n));
		}
	});
});
