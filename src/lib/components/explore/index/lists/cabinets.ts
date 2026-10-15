// Kabinetten since 1945 in the time they governed, filtered and sorted here.
import { partyColor } from '$lib/components/explore/party-color.svelte';
import { inOffice, type Cabinet } from '../government';
import { getCabinets } from '$lib/api/government';
import CabinetRows from '../rows/CabinetRows.svelte';
import CabinetStrip from '../rows/CabinetStrip.svelte';
import { countBy, defineList, matches, sorted, toggle } from './list';

export const cabinets = defineList<Cabinet, object, null>({
	sorts: [
		{ id: 'date', label: 'Aantreden', dir: 'desc' },
		{ id: 'bills', label: 'Wetsvoorstellen', dir: 'desc' },
		{ id: 'name', label: 'Naam', dir: 'asc' }
	],
	placeholder: 'Zoek op naam, minister-president of partij',
	columns: { lead: 'Periode', body: 'Kabinet', aside: 'Bewindspersonen', asideW: 130 },
	noun: 'kabinetten',
	needs: ['government'],
	period: () => ({ label: 'Periode', unit: 'year' }),
	query: () => null,
	load: async () => {
		const items = await getCabinets();
		return { items, total: items.length };
	},
	shown: (rows, { p, sort, dir, shared }) =>
		sorted(
			rows.filter(
				(c) =>
					(!p.coalition || (c.parties ?? []).some((x) => x.short === p.coalition)) &&
					(!p.from ||
						(c.to_date ?? (inOffice(c, shared.cabinets) ? '9999' : (c.from_date ?? ''))) >=
							p.from) &&
					(!p.to || (c.from_date ?? '') <= p.to) &&
					(!p.q ||
						matches(p.q, c.name) ||
						matches(p.q, c.prime_minister?.name) ||
						(c.parties ?? []).some((x) => matches(p.q, x.short)))
			),
			{
				date: (c) => c.from_date ?? '',
				bills: (c) => c.bills,
				name: (c) => c.name
			},
			sort,
			dir
		),
	countShown: true,
	facets: ({ p, shared, patch }) => {
		/** Parties in a coalition, with the number of cabinets they were in. */
		const parties = [
			...countBy(
				shared.cabinets.flatMap((c) => (c.parties ?? []).flatMap((x) => x.short ?? [])),
				(x) => x
			)
		]
			.filter(([, n]) => n > 1)
			.sort((a, b) => b[1] - a[1]);
		return [
			{
				id: 'coalition',
				label: 'In de coalitie',
				note: 'kabinetten',
				kind: 'list',
				options: parties.map(([x, n]) => ({
					id: x,
					label: x,
					count: n,
					swatch: partyColor(x),
					on: p.coalition === x,
					onClick: toggle(patch, 'coalition', p.coalition, x)
				}))
			}
		];
	},
	Figure: CabinetStrip,
	Rows: CabinetRows
});
