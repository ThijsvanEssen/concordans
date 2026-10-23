import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import IndexFacets, { selectOptions, type FacetGroup } from './IndexFacets.svelte';

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

describe('selectOptions', () => {
	const name = (k: string) => ({ bz: 'Buitenlandse Zaken', fin: 'Financiën' })[k] ?? k;
	it('names the chosen value, also where the counts lack it (#136)', () => {
		expect(selectOptions(new Map(), 'bz', name)).toEqual([
			{ value: 'bz', label: 'Buitenlandse Zaken' }
		]);
		expect(selectOptions(new Map([['bz', 3]]), 'bz', name)).toEqual([
			{ value: 'bz', label: 'Buitenlandse Zaken', count: 3 }
		]);
		expect(selectOptions(new Map([['fin', 2]]), '', name)).toEqual([
			{ value: 'fin', label: 'Financiën', count: 2 }
		]);
	});
});

describe('IndexFacets: a column of many groups folds all but the first (A192)', () => {
	const group = (n: number, on = false): FacetGroup => ({
		id: `g${n}`,
		label: `Groep ${n}`,
		kind: 'list',
		options: [{ id: `o${n}`, label: `Optie ${n}`, on, onClick: () => {}, count: n }]
	});
	const four = [1, 2, 3, 4, 5].map((n) => group(n));

	it('keeps the first group and the heads of the rest, each head a button', () => {
		const t = text({ groups: four });
		expect(t).toContain('Optie 1');
		expect(t).not.toMatch(/Optie [2345]/);
		expect(t).toMatch(/Groep 2.*Groep 3.*Groep 4.*Groep 5/);
		const html = render(IndexFacets, { props: { groups: four } }).body;
		expect(html.match(/aria-expanded="false"/g)).toHaveLength(4);
	});

	it('opens a group that holds a chosen option', () => {
		const t = text({ groups: [group(1), group(2), group(3), group(4), group(5, true)] });
		expect(t).toContain('Optie 5');
		expect(t).not.toMatch(/Optie [234]/);
	});

	it('opens a group that says open', () => {
		const t = text({
			groups: [group(1), group(2), { ...group(3), open: true }, group(4), group(5)]
		});
		expect(t).toContain('Optie 3');
		expect(t).not.toMatch(/Optie [245]/);
	});

	it('leaves a column of fewer than five groups open, without buttons on the heads', () => {
		const three = four.slice(0, 4);
		expect(text({ groups: three })).toMatch(/Optie 1.*Optie 2.*Optie 3.*Optie 4/);
		expect(render(IndexFacets, { props: { groups: three } }).body).not.toContain('aria-expanded');
	});
});
