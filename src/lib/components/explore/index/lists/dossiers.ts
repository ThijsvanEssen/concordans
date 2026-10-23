// Dossiers: the Kamer's dossiers by number, the open ones unless asked otherwise.
import type { Schema } from '$lib/api/types';
import { formatCount } from '$lib/text/getal';
import { choiceOf, facetOptions } from '$lib/util/choice';
import {
	NO_KIND_LABEL,
	OUTCOME_LABEL,
	PHASES,
	type Outcome
} from '$lib/components/parliamentary/stages';
import { faceted } from '../faceted';
import { OPEN_STATUS } from '../government';
import type { FacetsOf } from '$lib/api/lists';
import { ministryName } from '../ministries.svelte';
import DossierRows from '../rows/DossierRows.svelte';
import { PAGE, defineList, facetMap, toggle, type SortDef } from './list';
import type { IndexParams } from './params';

type Row = Schema<'DossierSummaryDTO'>;
type State = { facets: FacetsOf<'/api/dossiers'> };

const OUTCOMES = Object.keys(OUTCOME_LABEL) as Outcome[];

const query = (p: IndexParams, sort: SortDef) => ({
	status: p.dossierScope,
	outcome: p.outcome,
	subject: p.q || undefined,
	phase: p.phases.length ? p.phases.join(',') : undefined,
	has_phase: p.hasPhase || undefined,
	kind: p.track || undefined,
	ministry: p.ministry || undefined,
	opened_from: p.from || undefined,
	opened_to: p.to || undefined,
	sort: choiceOf(sort.id, ['number', 'opened_on', 'last_activity', 'closed_on', 'title'] as const),
	limit: PAGE
});

export const dossiers = defineList<Row, State, ReturnType<typeof query>>({
	// Sorted by the API, over all pages.
	sorts: [
		{ id: 'opened_on', label: 'Geopend (nieuw → oud)' },
		// The day of its newest paper, activity or decision (API 0.75).
		{ id: 'last_activity', label: 'Laatste activiteit' },
		{ id: 'number', label: 'Kamerstuknummer' },
		{ id: 'closed_on', label: 'Afgehandeld (nieuw → oud)' },
		{ id: 'title', label: 'Titel' }
	],
	placeholder: 'Zoek op nummer of in titel',
	columns: { lead: 'Nummer', body: 'Titel', aside: 'Fase', asideW: 150 },
	noun: 'dossiers',
	emptyNoun: (p) =>
		p.dossierScope === 'open'
			? 'openstaande dossiers'
			: p.dossierScope === 'closed'
				? 'afgehandelde dossiers'
				: 'dossiers',
	widen: (p) =>
		p.dossierScope === 'open'
			? { label: 'Zoek ook in afgehandelde dossiers', patch: { stand: 'all' } }
			: null,
	needs: ['government'],
	// When the dossier was opened (`opened_from`/`opened_to`), as every list with dates has
	// its period (Thijs, 9 Oct).
	period: () => ({ label: 'Geopend', unit: 'date' }),
	query,
	load: (q, offset, signal, apart, set) =>
		faceted('/api/dossiers', q, apart, (f) => set({ facets: f.facets ?? null }))(offset, signal),
	facets: ({ p, state, patch }) => {
		const kindCounts = facetMap(state.facets?.kind);
		const phaseCounts = facetMap(state.facets?.phase);
		const statusCounts = facetMap(state.facets?.status);
		const outcomes = facetMap(state.facets?.outcome);
		// The kinds are the ones the API counts, in its order, the chosen one always. A
		// dossier without a kind (letters and motions) cannot be chosen: it is counted.
		const kinds = facetOptions(kindCounts, p.track).map(([k]) => k);
		const withoutKind = kindCounts.get('null') ?? 0;
		const scope = (v: 'open' | 'closed' | 'all') => () =>
			patch({ stand: v === 'open' ? null : v, uitkomst: null });
		const { dossierScope, outcome } = p;
		return [
			{
				id: 'stand',
				label: 'Stand',
				kind: 'list',
				options: [
					{
						id: 'open',
						label: OPEN_STATUS,
						count: statusCounts.get('open') ?? 0,
						on: dossierScope === 'open',
						default: !p.dossierStatus,
						onClick: scope('open')
					},
					{
						id: 'closed',
						label: 'Afgehandeld',
						count: statusCounts.get('closed') ?? 0,
						on: dossierScope === 'closed' && !outcome,
						onClick: scope(dossierScope === 'closed' && !outcome ? 'open' : 'closed')
					},
					...OUTCOMES.filter((o) => (outcomes.get(o) ?? 0) > 0 || o === outcome).map((o) => ({
						id: o,
						label: OUTCOME_LABEL[o],
						count: outcomes.get(o) ?? 0,
						indent: true,
						on: outcome === o,
						onClick: () =>
							patch(outcome === o ? { uitkomst: null } : { uitkomst: o, stand: 'closed' })
					})),
					{
						id: 'all',
						label: 'Alle dossiers',
						count: (statusCounts.get('open') ?? 0) + (statusCounts.get('closed') ?? 0),
						on: dossierScope === 'all',
						// Chosen by a number searched for, not by the reader.
						default: !p.dossierStatus,
						onClick: scope(dossierScope === 'all' ? 'open' : 'all')
					}
				]
			},
			{
				id: 'track',
				label: 'Dossiersoort',
				note: withoutKind
					? `${formatCount(withoutKind)} ${NO_KIND_LABEL.toLowerCase()}, zonder soort`
					: undefined,
				kind: 'list',
				options: kinds.map((k) => ({
					id: k,
					label: k,
					count: kindCounts.get(k) ?? 0,
					on: p.track === k,
					onClick: toggle(patch, 'track', p.track, k)
				}))
			},
			{
				id: 'phase',
				label: 'Fase',
				note: `${formatCount(PHASES.reduce((n, ph) => n + (phaseCounts.get(ph) ?? 0), 0))} met fase`,
				kind: 'list',
				options: PHASES.map((ph) => ({
					id: ph,
					label: ph,
					count: phaseCounts.get(ph) ?? 0,
					on: p.phases.includes(ph),
					onClick: () => {
						const next = p.phases.includes(ph)
							? p.phases.filter((x) => x !== ph)
							: [...p.phases, ph];
						patch({ phase: next.length ? next.join(',') : null });
					}
				}))
			},
			{
				id: 'ministry',
				label: 'Ministerie',
				kind: 'list',
				options: facetOptions(facetMap(state.facets?.ministry), p.ministry)
					.sort((a, b) => b[1] - a[1])
					.map(([m, n]) => ({
						id: m,
						label: ministryName(m),
						count: n,
						on: p.ministry === m,
						onClick: toggle(patch, 'ministerie', p.ministry, m)
					}))
			}
		];
	},
	Rows: DossierRows
});
