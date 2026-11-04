// The Legenda counts what is drawn, with a bron selected too, open as closed (besluit 29):
// the focus's direct verbindingen are in Verbonden, not counted again here.
import { describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import GraphSidebar from './GraphSidebar.svelte';
import { EMPTY_FILTER, FILTER_GROUPS } from '$lib/verbonden/filter';
import { DEFAULT_LOADER_OPTIONS } from '$lib/verbonden/loaders';

const props = (_selectionCollection: 'documents' | null) => ({
	verbonden: {
		id: 'documents/x',
		groups: [],
		loading: false,
		failed: false,
		options: DEFAULT_LOADER_OPTIONS
	},
	filter: EMPTY_FILTER,

	onFilter: () => {},
	onOpenFilter: () => {},
	hiddenLines: new Set<never>(),
	onToggleLine: () => {},
	canvasCounts: {
		kinds: { stemmingen: 49, stukken: 30 },
		stuksoorten: { wetsvoorstellen: 20, toelichtingen: 10 }
	},
	hasNodes: true
});

describe('the Legenda counts', () => {
	for (const selectionCollection of [null, 'documents'] as const)
		it(`what the canvas draws, ${selectionCollection ? 'with' : 'without'} a selection`, () => {
			const { getByRole } = render(GraphSidebar, props(selectionCollection));
			expect(getByRole('button', { name: /^Stemmingen/ }).textContent).toMatch(/49/);
			expect(getByRole('button', { name: /^Stukken/ }).textContent).toMatch(/30/);
			// What the stukken are stands under their row, no block of its own.
			expect(getByRole('button', { name: /^Wetsvoorstellen/ }).textContent).toMatch(/20/);
			expect(getByRole('button', { name: /^Toelichtingen/ }).textContent).toMatch(/10/);
		});
});

describe('the stuksoorten under a Stukken that is off (B105)', () => {
	const off = { ...EMPTY_FILTER, bronnen: new Set(FILTER_GROUPS.filter((k) => k !== 'stukken')) };
	const rows = [/^Wetsvoorstellen/, /^Toelichtingen/];
	const row = (name: RegExp, filter: typeof EMPTY_FILTER) => {
		cleanup();
		return render(GraphSidebar, { ...props(null), filter }).getByRole('button', { name });
	};

	it('stand grey with no tick, a screen reader hearing them off', () => {
		for (const name of rows) {
			const r = row(name, off);
			expect(r.classList.contains('is-dim')).toBe(true);
			expect(r.getAttribute('aria-pressed')).toBe('false');
			expect(r.querySelector('.vinkje.is-active')).toBeNull();
		}
	});

	it('stand in ink while Stukken is on', () => {
		const r = row(/^Wetsvoorstellen/, EMPTY_FILTER);
		expect(r.classList.contains('is-dim')).toBe(false);
		expect(r.getAttribute('aria-pressed')).toBe('true');
	});

	it('keep their own choice for when Stukken is on again', () => {
		const chosen = { ...EMPTY_FILTER, stuksoort: new Set(['toelichtingen' as const]) };
		const back = (f: typeof EMPTY_FILTER) => row(/^Toelichtingen/, f).getAttribute('aria-pressed');
		expect(back({ ...chosen, bronnen: off.bronnen })).toBe('false');
		expect(back(chosen)).toBe('true');
		expect(row(/^Wetsvoorstellen/, chosen).getAttribute('aria-pressed')).toBe('false');
	});
});
