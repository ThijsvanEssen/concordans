// Commissies of a Kamer, filtered and sorted here: the API gives them all at once.
import { api, unwrap } from '$lib/api/client';
import type { Schema } from '$lib/api/types';
import CommitteeRows from '../rows/CommitteeRows.svelte';
import { defineList, flag, matches, sorted, type Columns, type SortDef } from './list';
import type { IndexParams } from './params';

type Row = Schema<'CommitteeDTO'>;

const SORTS: SortDef[] = [
	{ id: 'dossiers', label: 'Actieve dossiers', dir: 'desc' },
	{ id: 'abbreviation', label: 'Afkorting', dir: 'asc' },
	{ id: 'name', label: 'Naam', dir: 'asc' }
];
const COLUMNS: Columns = {
	lead: 'Afkorting',
	body: 'Commissie',
	aside: 'Lopende dossiers',
	asideW: 130
};

/** The Eerste Kamer's committees are not yet linked to dossiers: no sort, column or filter by them. */
const noDossiers = (p: IndexParams) => p.kamer === 'EK';

const query = (p: IndexParams) => ({
	chamber: p.kamer,
	active_from: p.from || undefined,
	active_to: p.to || undefined
});

export const committees = defineList<Row, object, ReturnType<typeof query>>({
	sorts: (p) => (noDossiers(p) ? SORTS.filter((o) => o.id !== 'dossiers') : SORTS),
	placeholder: 'Zoek op afkorting of naam',
	columns: (p) => (noDossiers(p) ? { ...COLUMNS, aside: '' } : COLUMNS),
	noun: 'commissies',
	chamber: true,
	period: () => ({ label: 'Actief', unit: 'date' }),
	query,
	load: async (query, _offset, signal) => {
		const items = await unwrap(api.GET('/api/committees', { params: { query }, signal }));
		return { items, total: items.length };
	},
	shown: (rows, { p, sort, dir }) =>
		sorted(
			rows.filter(
				(c) =>
					(!p.onlyActive || (c.active_dossier_count ?? 0) > 0) &&
					(!p.q || matches(p.q, c.name) || matches(p.q, c.abbreviation) || matches(p.q, c.slug))
			),
			{
				dossiers: (c) => c.active_dossier_count ?? 0,
				abbreviation: (c) => c.abbreviation ?? '',
				name: (c) => c.name ?? ''
			},
			sort,
			dir
		),
	countShown: true,
	facets: ({ p, patch }) =>
		noDossiers(p)
			? []
			: [
					{
						id: 'only_active',
						label: 'Weergave',
						kind: 'list',
						options: [
							{
								id: 'active',
								label: 'Alleen met lopende dossiers',
								on: p.onlyActive,
								onClick: flag(patch, 'only_active', p.onlyActive)
							}
						]
					}
				],
	composition: (rows) => rows[0]?.source,
	Rows: CommitteeRows
});
