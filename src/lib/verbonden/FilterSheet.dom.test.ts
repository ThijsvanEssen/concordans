import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import FilterSheet from './FilterSheet.svelte';
import { panel } from './panel-groups.svelte';
import { EMPTY_FILTER } from './filter';
import type { Group } from './groups';
import type { Row } from './rows';

afterEach(() => {
	cleanup();
	panel.groups = null;
});

const row = (key: string, relation: string): Row =>
	({
		ref: { collection: 'articles', key },
		title: key,
		context: null,
		filterGroup: 'artikelen',
		relation
	}) as Row;

const group = (id: string, n: number, relation = 'REFERS_TO'): Group =>
	({
		id,
		label: id,
		rows: Array.from({ length: n }, (_, i) => row(`${id}${i}`, relation)),
		capped: false
	}) as Group;

const props = (groups: Group[]) => ({
	open: true,
	filter: EMPTY_FILTER,
	groups,
	selection: 'articles' as const,
	onApply: () => {},
	onClose: () => {}
});

describe('FilterSheet', () => {
	it('names the number of the panel on its button, and no count in its head', () => {
		panel.groups = [group('a', 4)];
		const { container, getByRole } = render(FilterSheet, props([group('a', 4), group('b', 9)]));
		expect(getByRole('button', { name: 'Toon 4' })).toBeTruthy();
		expect(container.querySelector('.sheet__title')?.textContent).toBe('Filter');
		expect(container.querySelector('.sheet__count')).toBeNull();
	});

	it('shows no "Wis alles" until something is chosen', () => {
		const { queryByText } = render(FilterSheet, props([group('a', 4)]));
		expect(queryByText('Wis alles')).toBeNull();
	});

	it('makes Snel and Zekerheid one choice among a few, not a list of ticks', () => {
		const { container } = render(FilterSheet, props([group('a', 4)]));
		const keuzes = [...container.querySelectorAll('[role="group"]')].map((g) =>
			g.getAttribute('aria-label')
		);
		expect(keuzes).toContain('Zekerheid');
		for (const label of ['Zekerheid']) {
			const g = container.querySelector(`[role="group"][aria-label="${label}"]`)!;
			expect(g.querySelector('input[type="checkbox"], [role="checkbox"]')).toBeNull();
			expect(g.querySelectorAll('button[aria-pressed]').length).toBeGreaterThan(1);
		}
	});

	it('lists the relations as options with a count, under Relatie', () => {
		const { container } = render(FilterSheet, props([group('a', 3, 'REFERS_TO')]));
		const labels = [...container.querySelectorAll('.block__label')].map((e) => e.textContent);
		expect(labels).toContain('Relatie');
		expect(labels).toContain('Soort');
		expect(labels).not.toContain('Verbindingen');
		expect(labels).not.toContain('Betrouwbaarheid');
	});
});
