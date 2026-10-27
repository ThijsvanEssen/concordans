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
	canvasCounts: { kinds: { stemmingen: 49, wetsvoorstellen: 30 } },
	hasNodes: true
});

describe('the Legenda counts', () => {
	for (const selectionCollection of [null, 'documents'] as const)
		it(`what the canvas draws, ${selectionCollection ? 'with' : 'without'} a selection`, () => {
			const { getByRole } = render(GraphSidebar, props(selectionCollection));
			expect(getByRole('button', { name: /^Stemmingen/ }).textContent).toMatch(/49/);
			expect(getByRole('button', { name: /^Wetsvoorstellen/ }).textContent).toMatch(/30/);
		});
});
