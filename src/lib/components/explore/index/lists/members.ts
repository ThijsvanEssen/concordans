// Kamerleden: the sitting members of a Kamer, or with the historical ones; sorted by surname by the API.
import { getMembers } from '$lib/api/members';
import type { Schema } from '$lib/api/types';
import { choiceOf } from '$lib/util/choice';
import { partyColor } from '$lib/components/explore/party-color.svelte';
import { seatedOnly } from '../period';
import MemberRows from '../rows/MemberRows.svelte';
import { PAGE, defineList, flag, sorted, toggle, type SortDef } from './list';
import type { IndexParams } from './params';

type Row = Schema<'MemberDTO'>;

/**
 * The sitting members of a Kamer in one slice: no Kamer has more than 150 seats, and a list
 * without `total` can then count them.
 */
const SEATED = 200;

const query = (p: IndexParams, sort: SortDef) => {
	const seated = seatedOnly(p.includeInactive, p.from, p.to);
	return {
		chamber: p.kamer,
		q: p.q || undefined,
		party: p.party || undefined,
		active: seated || undefined,
		include_all: !seated,
		active_from: p.from || undefined,
		active_to: p.to || undefined,
		sort: choiceOf(sort.id, ['family_name', 'name'] as const),
		limit: seated ? SEATED : PAGE
	};
};

export const members = defineList<Row, object, ReturnType<typeof query>>({
	// By surname over all pages, as the API sorts it (BE-11): "Van der Lee" under L.
	sorts: [
		{ id: 'family_name', label: 'Achternaam' },
		{ id: 'party', label: 'Fractie', dir: 'asc' }
	],
	placeholder: 'Zoek op naam',
	columns: { lead: 'Fractie', body: 'Naam', aside: '', asideW: 60 },
	noun: 'kamerleden',
	chamber: true,
	needs: ['parties'],
	period: () => ({ label: 'Actief', unit: 'date' }),
	query,
	// A list without `total`: it is over when a slice comes back short.
	load: async (query, offset, signal) => ({
		items: await getMembers({ ...query, offset }, signal)
	}),
	shown: (rows, { sort, dir }) => sorted(rows, { party: (m) => m.party ?? '' }, sort, dir),
	facets: ({ p, shared, patch }) => [
		{
			id: 'party',
			label: 'Fractie',
			note: p.includeInactive ? undefined : 'zetels',
			kind: 'list',
			options: shared.parties.map((f) => ({
				id: f.abbreviation,
				label: f.abbreviation,
				swatch: partyColor(f.abbreviation),
				// The seats are the sitting members; with historical ones they no longer are.
				count: p.includeInactive ? undefined : (f.seats ?? undefined),
				on: p.party === f.abbreviation,
				onClick: toggle(patch, 'fractie', p.party, f.abbreviation)
			}))
		},
		// The Eerste Kamer is known from our first read on: no history to show or filter by.
		...(p.kamer === 'EK'
			? []
			: [
					{
						id: 'include_inactive',
						label: 'Weergave',
						kind: 'list' as const,
						options: [
							{
								id: 'hist',
								label: 'Ook historische leden',
								on: p.includeInactive,
								onClick: flag(patch, 'include_inactive', p.includeInactive)
							}
						]
					}
				])
	],
	composition: (rows) => rows[0]?.ek?.source,
	Rows: MemberRows
});
