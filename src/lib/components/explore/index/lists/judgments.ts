// Uitspraken: the judgments of the Dutch courts whose text is loaded, of the EHRM and of the
// courts of the EU.
import type { Schema } from '$lib/api/types';
import { formatCount } from '$lib/text/getal';
import { choiceOf } from '$lib/util/choice';
import {
	COURT_KINDS,
	COURT_KIND_LABEL,
	TIERS,
	TIER_LABEL,
	type CourtKind,
	type EuropeanSource,
	type Tier
} from '$lib/vocabulary';
import type { FacetGroup } from '../facets';
import { COURT_GROUPS, MIXED_TIERS, SOURCE_OF_TIER } from '../courts';
import { faceted } from '../faceted';
import type { FacetsOf } from '$lib/api/lists';
import JudgmentRows from '../rows/JudgmentRows.svelte';
import JudgmentYears from '../rows/JudgmentYears.svelte';
import { areaTree, keepChosen, sourceFacet, type Area } from './areas';
import { PAGE, defineList, type ListContext, type SortDef } from './list';
import type { IndexParams } from './params';

type Row = Schema<'JudgmentListItemDTO'>;
export type JudgmentsState = { facets: FacetsOf<'/api/judgments'> };
type Context = ListContext<Row, JudgmentsState>;

const query = (p: IndexParams, sort: SortDef) => ({
	q: p.q || undefined,
	court: p.court || undefined,
	tier: p.tier ? [p.tier] : undefined,
	court_kind: p.courtKind,
	subject: p.subject || undefined,
	subject_area: p.subjectArea || undefined,
	procedure: p.procedure || undefined,
	// Without a source every judgment, the European among them; `echr` the EHRM alone, `cjeu`
	// the courts of the EU.
	source: p.source,
	from: p.from || undefined,
	to: p.to || undefined,
	sort: choiceOf(sort.id, ['date_desc', 'date_asc', 'citation_count'] as const),
	limit: PAGE
});

/** Without coverage the filters are the usual courts, without counts. */
const USUAL: Tier[] = [
	'hoge_raad',
	'parket',
	'raad_van_state',
	'gerechtshof',
	'rechtbank',
	'ehrm',
	'hvj_eu'
];

/**
 * The European courts the data holds as their own source (SOURCE_OF_TIER), by the coverage;
 * one chosen, or all without coverage. A court whose source is not in yet is a tier as any
 * other: the Dutch records that name it.
 */
function europeanSources(p: IndexParams, coverage: Context['shared']['coverage']) {
	const sources: Partial<Record<Tier, EuropeanSource>> = {};
	for (const [tier, source] of Object.entries(SOURCE_OF_TIER) as [Tier, EuropeanSource][])
		if (
			!coverage ||
			p.source === source ||
			coverage.courts.some((c) => c.source === source && c.count > 0)
		)
			sources[tier] = source;
	return sources;
}

/**
 * Counts per tier. Which courts there are comes from the coverage (`/api/stats/coverage`);
 * the counts under the period and search from the list's facet. A European court is its own
 * source (SOURCE_OF_TIER): the tier facet's `ehrm` or `hvj_eu` also counts the Dutch records
 * that name it as court, which choosing it leaves out.
 */
function courtCounts({ p, state, shared }: Context) {
	const coverage = shared.coverage;
	if (!coverage) return null;
	const own = europeanSources(p, coverage);
	const counts = new Map<Tier, number>();
	for (const t of coverage.tiers) if (t.tier) counts.set(t.tier as Tier, t.count);
	// Under the other filters, from the list's facet; under a European source it counts that
	// source alone, and the tiers keep the coverage's counts.
	if (!p.source) {
		if (state.facets) for (const t of TIERS) if (!own[t]) counts.set(t, 0);
		for (const f of state.facets?.tier ?? [])
			if (f.value && !own[f.value as Tier]) counts.set(f.value as Tier, f.count);
	}
	for (const [tier, source] of Object.entries(own) as [Tier, EuropeanSource][]) {
		const all = coverage.courts.filter((c) => c.source === source).reduce((n, c) => n + c.count, 0);
		// Under a search or a period, its judgments that match: the source facet counts every
		// source, whichever the list shows.
		counts.set(
			tier,
			p.q || p.from || p.to
				? (state.facets?.source?.find((x) => x.value === source)?.count ?? 0)
				: all
		);
	}
	return counts;
}

/** The courts under their group, each group a filter group under its own heading. */
function courtGroups(ctx: Context): FacetGroup[] {
	const { p, state, shared, patch } = ctx;
	const coverage = shared.coverage;
	const counts = courtCounts(ctx);
	const own = europeanSources(p, coverage);
	const held = (t: Tier) =>
		coverage
			? coverage.tiers.some((c) => c.tier === t && c.count > 0) || !!own[t] || t === p.tier
			: USUAL.includes(t) || t === p.tier;
	const named = new Set(COURT_GROUPS.flatMap((g) => g.tiers));
	const groups = [...COURT_GROUPS, { label: 'Overig', tiers: TIERS.filter((t) => !named.has(t)) }];
	/** The courts within the chosen tier, from the list's facet; one at a time. */
	const kindOptions = () => {
		const kinds = new Map<CourtKind, number>();
		for (const f of state.facets?.court_kind ?? [])
			if (f.value && COURT_KINDS.includes(f.value as CourtKind))
				kinds.set(f.value as CourtKind, f.count);
		if (p.courtKind && !kinds.has(p.courtKind)) kinds.set(p.courtKind, 0);
		return [...kinds].map(([k, count]) => ({
			id: `kind-${k}`,
			label: COURT_KIND_LABEL[k],
			count,
			indent: true,
			on: p.courtKind === k,
			onClick: () => patch({ court_kind: p.courtKind === k ? null : k })
		}));
	};
	// No heading inside a list, and so no indent.
	return groups.flatMap((g): FacetGroup[] => {
		const tiers = g.tiers.filter(held);
		if (!tiers.length) return [];
		const count = counts && tiers.reduce((n, t) => n + (counts.get(t) ?? 0), 0);
		const options = tiers.flatMap((t) => {
			const source = own[t] ?? null;
			const on = source ? p.source === source : !p.source && !p.court && p.tier === t;
			return [
				{
					id: t,
					label: TIER_LABEL[t],
					count: counts?.get(t),
					on,
					// One college or European court at a time: the address holds one tier (the API takes a list).
					onClick: () =>
						patch({
							tier: on || source ? null : t,
							court_kind: null,
							court: null,
							source: source && !on ? source : null
						})
				},
				...(on && MIXED_TIERS.includes(t) ? kindOptions() : [])
			];
		});
		return [
			{
				id: `court-${g.label}`,
				label: g.label,
				button: 'Instantie',
				note: count != null ? formatCount(count) : undefined,
				kind: 'list',
				options
			}
		];
	});
}

/** The Rechtspraak's rechtsgebieden: `subject_area` the main area, `subject` the source value. */
function judgmentAreas({ p, state, patch }: Context): FacetGroup[] {
	const areas: Area[] = (state.facets?.subject_area ?? []).flatMap((f) =>
		f.value
			? [
					{
						id: f.value,
						label: f.value,
						count: f.count,
						narrower: (f.narrower ?? []).flatMap((n) =>
							n.value ? [{ id: n.value, label: n.label ?? n.value, count: n.count }] : []
						)
					}
				]
			: []
	);
	const main =
		p.subjectArea || areas.find((a) => a.narrower.some((n) => n.id === p.subject))?.id || '';
	if (main) keepChosen(areas, main);
	return areaTree(areas, main, p.subject, (m, sub) => patch({ subject_area: m, subject: sub }));
}

export const judgments = defineList<Row, JudgmentsState, ReturnType<typeof query>>({
	sorts: [
		{ id: 'date_desc', label: 'Datum (nieuw → oud)' },
		{ id: 'date_asc', label: 'Datum (oud → nieuw)' },
		{ id: 'citation_count', label: 'Meest geciteerd' }
	],
	placeholder: 'Zoek in zaaknaam of ECLI',
	columns: { lead: 'Datum', body: 'Uitspraak', aside: 'Aangehaald', asideW: 110 },
	noun: 'uitspraken',
	needs: ['coverage'],
	period: () => ({ label: 'Periode', unit: 'year' }),
	query,
	load: (q, offset, signal, apart, set) =>
		faceted('/api/judgments', q, apart, (f) => set({ facets: f.facets ?? null }))(offset, signal),
	facets: (ctx) => [
		// The groups of courts under Instantie, each under its own heading in its menu.
		...courtGroups(ctx),
		...judgmentAreas(ctx),
		...sourceFacet(
			ctx.patch,
			'procedure',
			'Procedure',
			ctx.state.facets?.procedure,
			ctx.p.procedure
		)
	],
	// A European court chosen: its own source, whose stand the list says when it is not current.
	source: (p) => p.source ?? null,
	Figure: JudgmentYears,
	Rows: JudgmentRows
});
