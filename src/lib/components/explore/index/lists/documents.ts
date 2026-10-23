// Stukken of a Kamer, newest first: always one Kamer, as without a filter the list is slow.
import type { Schema } from '$lib/api/types';
import { facetOptions } from '$lib/util/choice';
import { faceted } from '../faceted';
import type { FacetsOf } from '$lib/api/lists';
import DocumentRows from '../rows/DocumentRows.svelte';
import { PAGE, defineList, facetMap, toggle } from './list';
import type { IndexParams } from './params';

type Row = Schema<'DocumentListItemDTO'>;
type State = { facets: FacetsOf<'/api/documents'> };

const query = (p: IndexParams) => ({
	chamber: p.kamer,
	kind: p.documentKind || undefined,
	letter_kind: p.letterKind ? ('article_100' as const) : undefined,
	dossier: p.q || undefined,
	from: p.from || undefined,
	to: p.to || undefined,
	limit: PAGE
});

/** The deepest page the API reads (`OFFSET_MAX`): further back it is a window of dates. */
const REACH = 10_000;

export const documents = defineList<Row, State, ReturnType<typeof query>>({
	reach: REACH,
	// From the last day shown: its date as `to` (inclusive), and the papers of that day already
	// shown as the offset into it.
	beyond: (q, loaded) => {
		const day = loaded.at(-1)?.date?.slice(0, 10);
		if (!day) return null;
		return {
			query: { ...q, to: day },
			offset: loaded.filter((d) => d.date?.slice(0, 10) === day).length
		};
	},
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
			label: 'Stuksoort',
			kind: 'list',
			options: facetOptions(facetMap(state.facets?.kind), p.documentKind)
				.sort((a, b) => b[1] - a[1])
				.map(([k, n]) => ({
					id: k,
					label: k,
					count: n,
					on: p.documentKind === k,
					onClick: toggle(patch, 'soort', p.documentKind, k)
				}))
		},
		// The letters by which the government informs the Kamer of a deployment of the armed
		// forces (artikel 100 Grondwet): no kind of their own in the source, so not in the facets.
		{
			id: 'brief',
			label: 'Inzet krijgsmacht',
			kind: 'list',
			options: [
				{
					id: 'artikel-100',
					label: 'Artikel 100-brieven',
					on: p.letterKind === 'artikel-100',
					onClick: toggle(patch, 'brief', p.letterKind, 'artikel-100')
				}
			]
		}
	],
	Rows: DocumentRows
});
