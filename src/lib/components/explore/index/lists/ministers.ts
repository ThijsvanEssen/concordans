// Bewindspersonen: one cabinet's posts as a chart, or the ministers of six cabinets side by side.
import { getCabinet } from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import { POSTS, POST_LABEL, currentCabinet, getCabinets, inOffice, period } from '../government';
import MinistersView from '../rows/MinistersView.svelte';
import { countBy, defineList, matches, type ListContext } from './list';
import type { FacetGroup } from '../IndexFacets.svelte';
import type { IndexParams } from './params';

/** One post in a cabinet, with the ministry it is under. */
export type MinisterRow = Schema<'CabinetPostDTO'> & {
	ministry: string | null;
	ministryName: string | null;
};

const query = (p: IndexParams) => ({ cabinet: p.cabinet, from: p.from, to: p.to });

function facets({ p, page, shared, patch }: ListContext<MinisterRow, object>): FacetGroup[] {
	const { cabinets } = shared;
	// Weergave first: a choice, not a filter, as the Kamer.
	const weergave: FacetGroup = {
		id: 'weergave',
		label: 'Weergave',
		kind: 'keuze',
		value: p.sideBySide ? 'naast' : 'kabinet',
		options: [
			{ value: 'kabinet', label: 'Eén kabinet' },
			{ value: 'naast', label: 'Naast elkaar', titel: 'De ministers van zes kabinetten' }
		],
		onChange: (v) => patch({ weergave: v === 'naast' ? 'naast' : null, post: null, open: null })
	};
	const earlier = cabinets
		.filter((c) => !inOffice(c, cabinets))
		.map((c) => ({ value: c.key, label: `${c.name}, ${period(c.from_date, c.to_date, false)}` }));
	const current = currentCabinet(cabinets);
	const inFunctie = current ? `${current.name} (in functie)` : 'Kabinet in functie';
	// Side by side the six end at the cabinet chosen: further back is an older one.
	if (p.sideBySide)
		return [
			weergave,
			{
				id: 'cabinet',
				label: 'Tot en met',
				kind: 'select',
				value: p.cabinet,
				all: inFunctie,
				options: earlier,
				onChange: (v) => patch({ cabinet: v || null, open: null })
			}
		];
	const postCounts = countBy(page?.items, (m) => m.post ?? '');
	return [
		weergave,
		{
			id: 'cabinet',
			label: 'Kabinet',
			kind: 'select',
			value: p.cabinet,
			all: inFunctie,
			options: earlier,
			onChange: (v) => patch({ cabinet: v || null, post: null })
		},
		{
			id: 'post',
			label: 'Functie',
			kind: 'list',
			options: POSTS.filter((x) => (postCounts.get(x) ?? 0) > 0 || x === p.post).map((x) => ({
				id: x,
				label: POST_LABEL[x],
				count: postCounts.get(x) ?? 0,
				on: p.post === x,
				onClick: () => patch({ post: p.post === x ? null : x })
			}))
		}
	];
}

export const ministers = defineList<MinisterRow, object, ReturnType<typeof query>>({
	// One order: the ministries in protocol order, as the chart draws them.
	sorts: [{ id: 'protocol', label: 'Ministerie' }],
	placeholder: 'Zoek op naam',
	columns: {
		lead: 'Functie',
		body: 'Bewindspersoon',
		aside: ['Dossiers', 'Wetsvoorstellen', 'Open toezeggingen'],
		asideW: 300
	},
	noun: 'bewindspersonen',
	needs: ['government'],
	// Side by side the cabinets are the period (Tot en met): no second one beside it.
	period: (p) => (p.sideBySide ? null : { label: 'In functie', unit: 'date' }),
	query,
	// The posts of the cabinet chosen, else the one in office; `of` the cabinet itself.
	load: async ({ cabinet, from, to }) => {
		const chosen = cabinet || currentCabinet(await getCabinets())?.key;
		if (!chosen) return { items: [], total: 0 };
		const detail = await getCabinet(chosen);
		const rows = (detail.ministries ?? []).flatMap((m) =>
			m.seats.flatMap((seat) =>
				seat.posts.map((post) => ({
					...post,
					ministry: m.ministry ?? null,
					ministryName: m.name ?? null
				}))
			)
		);
		// A post in the period: its own days meet it (a source value of the cabinet).
		const items = rows.filter(
			(post) =>
				(!from || !post.to_date || post.to_date >= from) &&
				(!to || !post.from_date || post.from_date <= to)
		);
		return { items, total: items.length, of: detail };
	},
	shown: (rows, { p }) =>
		rows.filter((m) => (!p.post || m.post === p.post) && (!p.q || matches(p.q, m.member.name))),
	countShown: true,
	facets,
	Figure: MinistersView
});
