// Fracties of a Kamer, the sitting ones unless the dissolved ones are asked for, under its hall.
import { api, unwrap } from '$lib/api/client';
import type { Schema } from '$lib/api/types';
import { seatedOnly } from '../period';
import FactionRows from '../rows/FactionRows.svelte';
import FactionsHall from '../rows/FactionsHall.svelte';
import { defineList, flag, sorted } from './list';
import type { IndexParams } from './params';

type Row = Schema<'FactionDTO'>;

const query = (p: IndexParams) => ({
	chamber: p.kamer,
	q: p.q || undefined,
	active: seatedOnly(p.includeInactive, p.from, p.to) || undefined,
	active_from: p.from || undefined,
	active_to: p.to || undefined
});

export const factions = defineList<Row, object, ReturnType<typeof query>>({
	sorts: [
		{ id: 'seats', label: 'Zetels', dir: 'desc' },
		{ id: 'abbreviation', label: 'Afkorting', dir: 'asc' },
		{ id: 'name', label: 'Naam', dir: 'asc' }
	],
	placeholder: 'Zoek op naam of afkorting',
	columns: { lead: 'Fractie', body: 'Naam', aside: 'Zetels', asideW: 110 },
	noun: 'fracties',
	chamber: true,
	period: () => ({ label: 'Actief', unit: 'date' }),
	query,
	load: async (query, _offset, signal) => {
		const items = await unwrap(api.GET('/api/factions', { params: { query }, signal }));
		return { items, total: items.length };
	},
	shown: (rows, { sort, dir }) =>
		sorted(
			rows,
			{
				seats: (f) => f.seats ?? 0,
				abbreviation: (f) => f.abbreviation ?? '',
				name: (f) => f.name ?? ''
			},
			sort,
			dir
		),
	// The Eerste Kamer is known from our first read on: no history to show or filter by.
	facets: ({ p, patch }) =>
		p.kamer === 'EK'
			? []
			: [
					{
						id: 'include_inactive',
						label: 'Weergave',
						kind: 'list',
						options: [
							{
								id: 'hist',
								label: 'Ook opgeheven fracties',
								on: p.includeInactive,
								onClick: flag(patch, 'include_inactive', p.includeInactive)
							}
						]
					}
				],
	// The Eerste Kamer's composition is named in the legend of its hall (FactionsHall).
	Header: FactionsHall,
	Rows: FactionRows
});
