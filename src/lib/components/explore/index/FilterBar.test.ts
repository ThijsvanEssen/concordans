import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import FilterBar from './FilterBar.svelte';
import FacetMenu from './FacetMenu.svelte';
import { activeFilters, barLayout, facetButtons, selectOptions, type FacetGroup } from './facets';

const noop = () => {};
const list = (id: string, label: string, extra: Partial<FacetGroup> = {}, on = false) =>
	({
		id,
		label,
		kind: 'list',
		options: [{ id: `${id}-1`, label: `${label} een`, on, onClick: noop, count: 3 }],
		...extra
	}) as FacetGroup;
const periode: FacetGroup = {
	id: 'period',
	label: 'In werking getreden',
	kind: 'range',
	unit: 'date',
	from: '2020-01-01',
	to: '',
	onChange: noop
};
const text = (html: string) =>
	html
		.replace(/<!--[^>]*-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

describe('the buttons of the bar (besluit 40, A205 variant A)', () => {
	it('puts groups that share a button under one, the period third as Periode', () => {
		const groups = [
			list('hr', 'Hoogste rechters', { button: 'Instantie' }),
			list('feit', 'Feitenrechtspraak', { button: 'Instantie' }),
			list('area', 'Rechtsgebied'),
			list('proc', 'Procedure'),
			periode
		];
		const k = facetButtons(groups);
		expect(k.map((b) => b.label)).toEqual(['Instantie', 'Rechtsgebied', 'Periode', 'Procedure']);
		expect(k[0].groups.map((g) => g.id)).toEqual(['hr', 'feit']);
		// Three buttons of their own, the rest under Meer, however few.
		expect(barLayout(groups).more.map((b) => b.label)).toEqual(['Procedure']);
	});

	it('puts the rest under Meer, after the first three', () => {
		const groups = [
			list('area', 'Rechtsgebied'),
			list('theme', 'Thema'),
			list('rechtsorde', 'Rechtsorde'),
			list('soort', 'Soort'),
			list('leeg', 'Weergave'),
			periode
		];
		const { bar, more } = barLayout(groups);
		expect(bar.map((b) => b.label)).toEqual(['Rechtsgebied', 'Thema', 'Periode']);
		expect(more.map((b) => b.label)).toEqual(['Rechtsorde', 'Soort', 'Weergave']);
	});
});

describe('FilterBar', () => {
	const props = { show: 'Toon 3 wetten', list: () => null, onClear: noop };

	it('marks a button whose filter holds a choice, and shows the choice as a chip', () => {
		const groups = [list('area', 'Rechtsgebied', {}, true), list('theme', 'Thema'), periode];
		const html = render(FilterBar, { props: { ...props, groups } }).body;
		expect(html.match(/class="mark[^"]*is-active/g)).toHaveLength(2);
		expect(text(html)).toContain('Rechtsgebied een');
		expect(text(html)).toMatch(/In werking getreden: Sinds 2020/);
		expect(html).toContain('aria-label="Rechtsgebied een wissen"');
		// Two chips: Wis alles; Filter (2) on a phone.
		expect(text(html)).toContain('Wis alles');
		expect(text(html)).toContain('Filter (2)');
	});

	it('names a chosen value on its button for a screen reader', () => {
		const html = render(FilterBar, {
			props: { ...props, groups: [list('area', 'Rechtsgebied', {}, true)] }
		}).body;
		expect(html).toContain('aria-label="Rechtsgebied: Rechtsgebied een"');
	});
});

describe('FacetMenu: counts, grey and found', () => {
	const button = (groups: FacetGroup[]) => ({ id: groups[0].id, label: 'Instantie', groups });
	const courts: FacetGroup = {
		id: 'court',
		label: 'Instantie',
		kind: 'list',
		options: [
			{ id: 'rb', label: 'Rechtbanken', on: false, onClick: noop, count: 509984 },
			{ id: 'kg', label: 'Kantongerechten', on: false, onClick: noop, count: 0 }
		]
	};

	it('shows the counts, an option of 0 grey but there (#80)', () => {
		const html = render(FacetMenu, { props: { button: button([courts]) } }).body;
		expect(text(html)).toContain('509.984');
		expect(html).toMatch(/class="optie[^"]*leeg/);
		expect(text(html)).toContain('Kantongerechten');
	});

	it('leaves the counts out when they are stale', () => {
		const html = render(FacetMenu, { props: { button: button([courts]), stale: true } }).body;
		expect(text(html)).not.toContain('509.984');
		expect(text(html)).toContain('Rechtbanken');
	});

	it('names each group of a button with more than one, as menu items in a menu', () => {
		const html = render(FacetMenu, {
			props: {
				menu: true,
				button: button([
					{ ...courts, id: 'hr', label: 'Hoogste rechters' },
					{ ...courts, id: 'feit', label: 'Feitenrechtspraak' }
				])
			}
		}).body;
		expect(text(html)).toMatch(/Hoogste rechters.*Feitenrechtspraak/);
		expect(html).toContain('role="menuitemcheckbox"');
	});

	it('gives a long list a field to find an option', () => {
		const many: FacetGroup = {
			id: 'soort',
			label: 'Stuksoort',
			kind: 'list',
			options: Array.from({ length: 20 }, (_, n) => ({
				id: `s${n}`,
				label: `Soort ${n}`,
				on: false,
				onClick: noop,
				count: n
			}))
		};
		const html = render(FacetMenu, { props: { button: button([many]) } }).body;
		expect(html).toContain('placeholder="Zoek een stuksoort"');
	});
});

describe('activeFilters', () => {
	it('gives each chip its value alone besides its label', () => {
		const [chip] = activeFilters([list('f', 'Ingediend door', { chip: 'Ingediend door' }, true)]);
		expect(chip.label).toBe('Ingediend door: Ingediend door een');
		expect(chip.short).toBe('Ingediend door een');
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
	});
});
