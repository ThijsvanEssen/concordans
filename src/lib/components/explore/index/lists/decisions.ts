// Stemmingen of a Kamer by sitting day, newest first; their total and facets counted apart.
import { OUTCOME_LABELS } from '$lib/text/outcome';
import type { Schema } from '$lib/api/types';
import { decisionsPage, geteld, nogTeTellen } from '$lib/api/decisions';
import { EK_SOURCE } from '$lib/components/parliamentary/chamber';
import { facetOptions } from '$lib/util/choice';
import { formatCount } from '$lib/text/getal';
import { MOTION_KINDS, MOTION_KIND_LABEL, MOTION_KIND_PARAM } from '$lib/text/motion-kind';
import DecisionRows from '../rows/DecisionRows.svelte';
import ChamberRest from '../rows/ChamberRest.svelte';
import { defineList, facetMap, sorted, toggle } from './list';
import type { IndexParams } from './params';

type Row = Schema<'DecisionSummaryDTO'>;
export type DecisionsState = {
	facets: Schema<'DecisionFacets'> | null;
	/** The stemmingen counted under the filters, from the facets asked apart (API 0.79.41). */
	total: number | null;
};

const query = (p: IndexParams) => ({
	chamber: p.kamer,
	kind: p.decisionKind || undefined,
	passed: p.passed === undefined ? undefined : p.passed === 'true',
	from: p.from || undefined,
	to: p.to || undefined,
	// One q, as the API takes several since 0.79.30 (all of them must match).
	q: p.q ? [p.q] : undefined,
	dossier: p.dossier || undefined,
	party: p.party || undefined,
	motion_kind: p.motionKind,
	limit: 200
});

export const decisions = defineList<Row, DecisionsState, ReturnType<typeof query>>({
	sorts: [
		{ id: 'date', label: 'Datum', dir: 'desc' },
		{ id: 'result', label: 'Uitslag', dir: 'asc' },
		{ id: 'subject', label: 'Onderwerp', dir: 'asc' }
	],
	placeholder: 'Zoek in onderwerp',
	columns: { lead: 'Soort', body: 'Onderwerp', aside: 'Uitslag', asideW: 180 },
	noun: 'stemmingen',
	chamber: true,
	period: () => ({ label: 'Datum', unit: 'date' }),
	query,
	// The rows without counting (facets=false: total null); the total and facets from one
	// row asked beside them, again later while still being counted.
	load: async (query, offset, signal, apart, set) => {
		if (!offset) {
			set({ total: null });
			apart(
				() => geteld({ ...query, offset: 0, limit: 1, facets: true }, signal),
				(t) => {
					// Still counting after the last wait: the facets stay, the total quiet.
					if (!nogTeTellen(t)) set({ facets: t.facets ?? null });
					if (t.total !== null) set({ total: t.total });
				},
				signal
			);
		}
		return decisionsPage(query, offset, signal);
	},
	total: (state) => state.total ?? null,
	// How many of the votes passed, from the facets that count the votes beside the rows.
	summary: ({ p, state }) => {
		const passed = p.passed === undefined ? facetMap(state.facets?.passed).get('true') : undefined;
		return passed == null ? null : `${formatCount(passed)} aangenomen`;
	},
	follow: (p) =>
		p.decisionKind || p.passed !== undefined || p.motionKind || p.party
			? null
			: {
					kind: 'stemming',
					chamber: p.kamer,
					since: p.from || undefined,
					until: p.to || undefined,
					q: p.q ? [p.q] : undefined,
					dossier: p.dossier || undefined
				},
	shown: (rows, { sort, dir }) =>
		sorted(
			rows,
			{
				date: (s) => s.date ?? '',
				result: (s) => Number(s.passed),
				subject: (s) => s.subject ?? ''
			},
			sort,
			dir
		),
	facets: ({ p, state, patch }) => {
		const outcomes = facetMap(state.facets?.passed);
		// The kinds the Kamer's decisions have, as the facet counts them; one without a zaak
		// cannot be chosen. The Eerste Kamer's decisions have none yet: no group then.
		const kinds = facetOptions(facetMap(state.facets?.kind), p.decisionKind).map(([k, n]) => ({
			id: k,
			label: k,
			count: n,
			on: p.decisionKind === k,
			onClick: toggle(patch, 'soort', p.decisionKind, k)
		}));
		// The motions of censure and of no confidence, where the votes under the filters hold
		// one; a chosen kind stays to be undone.
		const motionKinds = facetMap(state.facets?.motion_kind);
		const motions = MOTION_KINDS.filter((k) => motionKinds.has(k) || p.motionKind === k).map(
			(k) => ({
				id: k,
				label: MOTION_KIND_LABEL[k],
				count: motionKinds.get(k) ?? 0,
				on: p.motionKind === k,
				onClick: toggle(
					patch,
					'motie',
					p.motionKind && MOTION_KIND_PARAM[p.motionKind],
					MOTION_KIND_PARAM[k]
				)
			})
		);
		return [
			...(kinds.length || p.kamer === 'TK'
				? [{ id: 'soort', label: 'Stemmingsoort', kind: 'list' as const, options: kinds }]
				: []),
			{
				id: 'passed',
				label: 'Uitslag',
				kind: 'list',
				options: [
					{
						id: 'true',
						label: OUTCOME_LABELS.aangenomen,
						count: outcomes.get('true') ?? 0,
						on: p.passed === 'true',
						onClick: toggle(patch, 'passed', p.passed, 'true')
					},
					{
						id: 'false',
						label: OUTCOME_LABELS.verworpen,
						count: outcomes.get('false') ?? 0,
						on: p.passed === 'false',
						onClick: toggle(patch, 'passed', p.passed, 'false')
					}
				]
			},
			...(motions.length
				? [{ id: 'motie', label: 'Motie', kind: 'list' as const, options: motions }]
				: []),
			{
				id: 'dossier',
				label: 'Dossier',
				kind: 'text',
				value: p.dossier,
				placeholder: 'Kamerstuknummer',
				onChange: (v) => patch({ dossier: v || null })
			}
		];
	},
	Rows: DecisionRows,
	// When the Tweede Kamer meets and votes next, where it does not meet for days (API 0.80).
	Header: ChamberRest,
	after: (p) =>
		p.kamer === 'EK' ? { label: `${EK_SOURCE.name}, ${EK_SOURCE.site}`, href: EK_SOURCE.url } : null
});
