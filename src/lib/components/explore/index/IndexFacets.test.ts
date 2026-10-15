import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import IndexFacets, { selectOpties, type FacetGroup } from './IndexFacets.svelte';

const groups: FacetGroup[] = [
	{
		id: 'court',
		label: 'Instantie',
		kind: 'list',
		options: [
			{ id: 'rb', label: 'Rechtbanken', on: false, onClick: () => {}, count: 509984 },
			{ id: 'hr', label: 'Hoge Raad', on: false, onClick: () => {}, count: 57506 }
		]
	}
];

const text = (props: Record<string, unknown>) =>
	render(IndexFacets, { props: { groups, ...props } })
		.body.replace(/<!--[^>]*-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

describe('IndexFacets: counts that are not current are not shown (#80)', () => {
	it('shows the counts of the answer', () => {
		expect(text({})).toContain('57.506');
		expect(text({})).toContain('509.984');
	});

	it('leaves the counts out when they are stale, without the mark of loading', () => {
		const html = render(IndexFacets, { props: { groups, stale: true } }).body;
		expect(text({ stale: true })).not.toMatch(/57\.506|509\.984/);
		expect(text({ stale: true })).toContain('Hoge Raad');
		expect(html).not.toContain('aria-busy="true"');
	});
});

describe('selectOpties', () => {
	const naam = (k: string) => ({ bz: 'Buitenlandse Zaken', fin: 'Financiën' })[k] ?? k;
	it('names the chosen value, also where the counts lack it (#136)', () => {
		expect(selectOpties(new Map(), 'bz', naam)).toEqual([
			{ value: 'bz', label: 'Buitenlandse Zaken' }
		]);
		expect(selectOpties(new Map([['bz', 3]]), 'bz', naam)).toEqual([
			{ value: 'bz', label: 'Buitenlandse Zaken', count: 3 }
		]);
		expect(selectOpties(new Map([['fin', 2]]), '', naam)).toEqual([
			{ value: 'fin', label: 'Financiën', count: 2 }
		]);
	});
});
