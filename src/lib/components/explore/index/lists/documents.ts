// Stukken of a Kamer, newest first: always one Kamer, as without a filter the list is slow.
import type { Schema } from '$lib/api/types';
import { facetOptions } from '$lib/util/choice';
import { faceted, type FacetsOf } from '../faceted';
import DocumentRows from '../rows/DocumentRows.svelte';
import { PAGE, defineList, facetMap, toggle } from './list';
import type { IndexParams } from './params';

type Row = Schema<'DocumentListItemDTO'>;
type State = { facets: FacetsOf<'/api/documents'> };

const query = (p: IndexParams) => ({
	chamber: p.kamer,
	kind: p.soort || undefined,
	dossier: p.q || undefined,
	from: p.from || undefined,
	to: p.to || undefined,
	limit: PAGE
});

export const documents = defineList<Row, State, ReturnType<typeof query>>({
	// One order: newest first, as the API lists them.
	sorts: [{ id: 'date', label: 'Datum' }],
	placeholder: 'Zoek op Kamerstuknummer',
	columns: { lead: 'Kamerstuk', body: 'Stuk', aside: 'Datum', asideW: 110 },
	noun: 'stukken',
	chamber: true,
	period: () => ({ label: 'Datum', unit: 'date' }),
	query,
	load: (q, offset, signal, apart, set) =>
		faceted('/api/documents', q, apart, (f) => set({ facets: f.facets ?? null }))(offset, signal),
	facets: ({ p, state, patch }) => [
		{
			id: 'soort',
			label: 'Soort',
			kind: 'list',
			options: facetOptions(facetMap(state.facets?.kind), p.soort)
				.sort((a, b) => b[1] - a[1])
				.map(([k, n]) => ({
					id: k,
					label: k,
					count: n,
					on: p.soort === k,
					onClick: toggle(patch, 'soort', p.soort, k)
				}))
		}
	],
	Rows: DocumentRows
});
