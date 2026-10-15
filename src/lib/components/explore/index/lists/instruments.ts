// Wetten: the BWB, the treaties and the EU's acts, with the Staatsblad publications that amend them.
import { api, unwrap } from '$lib/api/client';
import { report } from '$lib/api/errors';
import type { Schema } from '$lib/api/types';
import { choiceOf } from '$lib/util/choice';
import { faceted, type FacetsOf } from '../faceted';
import InstrumentRows from '../rows/InstrumentRows.svelte';
import { areaTree, keepChosen, type Area } from './areas';
import { PAGE, defineList, flag, toggle, type SortDef } from './list';
import type { IndexParams } from './params';

type Row = Schema<'InstrumentListItemDTO'>;
type State = {
	facets: FacetsOf<'/api/instruments'>;
	/** The treaties under the filters chosen: asked apart, as the API counts no kinds yet. */
	treaties: number | null;
};

type Concept = { id?: string | null; slug?: string | null };
/** A TOOI concept in the URL: its slug, else its id. */
const conceptKey = (c: Concept | undefined) => c?.slug ?? c?.id ?? '';
/** Every concept of a register by slug and by id, so a link with either finds it. */
const byKey = <T extends Concept>(concepts: T[]) =>
	new Map(concepts.flatMap((c) => [c.slug, c.id].flatMap((k) => (k ? [[k, c] as const] : []))));

const query = (p: IndexParams, sort: SortDef) => ({
	q: p.q || undefined,
	jurisdiction: p.jurisdiction,
	kind: p.treaty,
	article_count_min: p.withEmpty ? undefined : 1,
	legal_area: p.legalArea || undefined,
	policy_domain: p.policyDomain || undefined,
	from: p.from || undefined,
	to: p.to || undefined,
	sort: choiceOf(sort.id, ['title', 'article_count'] as const),
	limit: PAGE
});

export const instruments = defineList<Row, State, ReturnType<typeof query>>({
	sorts: [
		{ id: 'title', label: 'Citeertitel' },
		{ id: 'article_count', label: 'Aantal artikelen' }
	],
	placeholder: 'Zoek in titel, BWB of citatie',
	columns: { lead: 'BWB of CELEX', body: 'Wet', aside: 'Rechtsorde', asideW: 110 },
	noun: 'wetten',
	period: () => ({ label: 'In werking getreden', unit: 'date' }),
	query,
	load: (q, offset, signal, apart, set) =>
		faceted('/api/instruments', q, apart, (f) => set({ facets: f.facets ?? null }))(
			offset,
			signal
		).then((r) => {
			if (offset) return r;
			// The count beside Verdragen: this list's own total where it is the treaties, else
			// one row asked under the same filters, beside the rows, not before them (live,
			// 10 Oct: rows in at 1.7 s, on screen at 4.1 s).
			if (q.kind) set({ treaties: r.total });
			else
				void unwrap(
					api.GET('/api/instruments', {
						params: { query: { ...q, kind: 'verdrag', limit: 1, offset: 0, facets: false } },
						signal
					})
				)
					.then((v) => {
						if (!signal.aborted) set({ treaties: v.total });
					})
					.catch((e) => report('Aantal verdragen', e));
			return r;
		}),
	facets: ({ p, state, patch }) => {
		const legal = byKey(
			(state.facets?.legal_area ?? []).flatMap((f) => [f, ...(f.narrower ?? [])])
		);
		const themes = byKey(state.facets?.policy_domain ?? []);
		return [
			...lawAreas(),
			...lawThemes(),
			{
				id: 'jurisdiction',
				label: 'Rechtsorde',
				kind: 'list',
				options: [
					{
						id: 'nl',
						label: 'Nederland',
						on: p.jurisdiction === 'nl',
						onClick: toggle(patch, 'jurisdiction', p.jurisdiction, 'nl')
					},
					{
						id: 'eu',
						label: 'Europese Unie',
						on: p.jurisdiction === 'eu',
						onClick: toggle(patch, 'jurisdiction', p.jurisdiction, 'eu')
					}
				]
			},
			{
				id: 'soort',
				label: 'Soort',
				kind: 'list',
				options: [
					{
						id: 'verdrag',
						label: 'Verdragen',
						count: state.treaties ?? undefined,
						on: p.treaty === 'verdrag',
						onClick: toggle(patch, 'soort', p.treaty, 'verdrag')
					}
				]
			},
			{
				id: 'leeg',
				label: 'Weergave',
				kind: 'list',
				options: [
					{
						id: 'leeg',
						label: 'Ook zonder artikelen',
						on: p.withEmpty,
						onClick: flag(patch, 'leeg', p.withEmpty)
					}
				]
			}
		];

		/**
		 * The BWB's rechtsgebieden (TOOI). One parameter holds the main or the specific area,
		 * by slug; a link with the TOOI id finds it too.
		 */
		function lawAreas() {
			const areas: Area[] = (state.facets?.legal_area ?? []).flatMap((f) =>
				conceptKey(f)
					? [
							{
								id: conceptKey(f),
								label: f.label,
								count: f.count,
								narrower: (f.narrower ?? []).flatMap((n) =>
									conceptKey(n) ? [{ id: conceptKey(n), label: n.label, count: n.count }] : []
								)
							}
						]
					: []
			);
			if (p.legalArea && !legal.has(p.legalArea)) keepChosen(areas, p.legalArea);
			const chosen = (key: string) =>
				p.legalArea !== '' && key === (conceptKey(legal.get(p.legalArea)) || p.legalArea);
			const main = areas.find((a) => chosen(a.id) || a.narrower.some((n) => chosen(n.id)));
			const sub = main?.narrower.find((n) => chosen(n.id));
			return areaTree(
				areas,
				main?.id ?? '',
				sub?.id ?? '',
				(m, s) => patch({ legal_area: s ?? m }),
				8
			);
		}

		/** The government themes of the BWB (TOOI), one at a time. */
		function lawThemes() {
			const chosen = conceptKey(themes.get(p.policyDomain)) || p.policyDomain;
			const all = [...(state.facets?.policy_domain ?? [])];
			if (p.policyDomain && !themes.has(p.policyDomain))
				all.unshift({ slug: p.policyDomain, label: p.policyDomain, count: 0 });
			const options = all.flatMap((f) => {
				const value = conceptKey(f);
				if (!value) return [];
				const on = value === chosen;
				return [
					{
						id: value,
						label: f.label,
						count: f.count,
						on,
						onClick: () => patch({ policy_domain: on ? null : value })
					}
				];
			});
			return options.length
				? [{ id: 'theme', label: 'Thema', kind: 'list' as const, preview: 6, options }]
				: [];
		}
	},
	Rows: InstrumentRows
});
