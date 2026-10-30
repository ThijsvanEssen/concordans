// The Legenda counts what is drawn, with a bron selected too, open as closed (besluit 29):
// the focus's direct verbindingen are in Verbonden, not counted again here.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import GraphSidebar from './GraphSidebar.svelte';
import { EMPTY_FILTER } from '$lib/verbonden/filter';
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
			// What the stukken are is a block of its own, the stuksoort.
			expect(getByRole('button', { name: /^Wetsvoorstellen/ }).textContent).toMatch(/20/);
			expect(getByRole('button', { name: /^Toelichtingen/ }).textContent).toMatch(/10/);
		});
});

// Keten keys its own drawing under Tonen and Relatie (B53): the bron it starts from in ink, and
// in the keten of a law the frame of the articles on a line, whole or dashed.
describe('the Legenda of Keten', () => {
	const keten = (chain: { start: 'instruments' | null; labels: boolean } | null) => ({
		...props(null),
		canvasCounts: {
			kinds: { wetten: 15, europees: 1 },
			lines: { structural: 14, citation: 3 }
		},
		chain
	});
	const sleutel = (c: HTMLElement) =>
		[...c.querySelectorAll('.sleutel--keten')].map((p) =>
			p.textContent?.replace(/\s+/g, ' ').trim()
		);

	it('names the bron the keten starts from', () => {
		const { container } = render(GraphSidebar, keten({ start: 'instruments', labels: true }));
		expect(sleutel(container)).toContain('Gekozen bron');
	});
	it('keys the articles on a line: whole for a grondslag, dashed for a mention', () => {
		const { container } = render(GraphSidebar, keten({ start: 'instruments', labels: true }));
		expect(sleutel(container)).toEqual([
			'Gekozen bron',
			'art.Grondslag',
			'art.Noemt, of grondslag onbekend'
		]);
		const frames = [...container.querySelectorAll('.artikel')];
		expect(frames.map((f) => f.classList.contains('artikel--genoemd'))).toEqual([false, true]);
	});
	it('stands each frame under its own row of Relatie', () => {
		const { container } = render(GraphSidebar, keten({ start: 'instruments', labels: true }));
		const structural = container.querySelector('.artikel:not(.artikel--genoemd)')!;
		const row = structural.closest('.sleutel')!.previousElementSibling;
		expect(row?.textContent).toMatch(/Structureel/);
	});
	it('has no frames in a keten without articles on its lines (a judgment, a fractie)', () => {
		const { container } = render(GraphSidebar, keten({ start: null, labels: false }));
		expect(sleutel(container)).toEqual(['Gekozen bron']);
	});
	it('keys nothing of the keten in Omgeving', () => {
		const { container } = render(GraphSidebar, keten(null));
		expect(container.querySelector('.sleutel--keten')).toBeNull();
	});
});
