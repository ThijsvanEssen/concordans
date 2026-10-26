// Ministeries in protocol order: those that exist first, the abolished ones after them.
import { getMinistries } from '$lib/api/government';
import type { Ministry } from '../government';
import MinistryRows from '../rows/MinistryRows.svelte';
import { defineList, matches, sorted } from './list';

/** A ministry that exists has a TOOI code and no last day; without a code it is abolished, dated or not. */
export const isCurrent = (m: Ministry) => !!m.tooi && !m.until;

export const ministries = defineList<Ministry, object, null>({
	sorts: [
		{ id: 'order', label: 'Protocol' },
		{ id: 'name', label: 'Naam', dir: 'asc' }
	],
	placeholder: 'Zoek op naam of afkorting',
	columns: { lead: 'Periode', body: 'Ministerie', aside: 'Afkorting', asideW: 160 },
	noun: 'ministeries',
	needs: ['government'],
	period: () => null,
	query: () => null,
	load: async () => {
		const items = await getMinistries();
		return { items, total: items.length };
	},
	shown: (rows, { p, sort, dir }) => {
		const found = sorted(
			rows.filter((m) => !p.q || matches(p.q, m.name) || matches(p.q, m.abbreviation)),
			{ name: (m) => m.name },
			sort,
			dir
		);
		return [...found.filter(isCurrent), ...found.filter((m) => !isCurrent(m))];
	},
	countShown: true,
	facets: () => [],
	Rows: MinistryRows
});
