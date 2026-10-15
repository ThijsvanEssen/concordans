// Toezeggingen of bewindspersonen to the Kamer, by the day they were made or are expected.
import type { Schema } from '$lib/api/types';
import { choiceOf } from '$lib/util/choice';
import { COMMITMENT_STATUSES } from '../government';
import { faceted } from '../faceted';
import type { FacetsOf } from '$lib/api/lists';
import CommitmentRows from '../rows/CommitmentRows.svelte';
import { PAGE, defineList, flag, toggle, type SortDef } from './list';
import type { IndexParams } from './params';

type Row = Schema<'CommitmentDTO'>;
type State = { facets: FacetsOf<'/api/commitments'> };

const query = (p: IndexParams, sort: SortDef) => ({
	cabinet: p.cabinet || undefined,
	ministry: p.ministry || undefined,
	member: p.member || undefined,
	overdue: p.overdue || undefined,
	q: p.q || undefined,
	from: p.from || undefined,
	to: p.to || undefined,
	status: p.commitmentStatus,
	sort: choiceOf(sort.id, ['date', 'expected_resolution'] as const),
	limit: PAGE
});

export const commitments = defineList<Row, State, ReturnType<typeof query>>({
	sorts: [
		{ id: 'date', label: 'Datum' },
		{ id: 'expected_resolution', label: 'Verwachte afdoening' }
	],
	placeholder: 'Zoek in de tekst',
	columns: { lead: 'Gedaan', body: 'Toezegging', aside: 'Verwacht', asideW: 130 },
	noun: 'toezeggingen',
	needs: ['government'],
	period: () => ({ label: 'Gedaan', unit: 'date' }),
	query,
	load: (q, offset, signal, apart, set) =>
		faceted('/api/commitments', q, apart, (f) => set({ facets: f.facets ?? null }))(offset, signal),
	facets: ({ p, state, page, shared, patch }) => {
		/** The number of commitments in each state, under the other filters. */
		const counts =
			state.facets === undefined
				? null
				: new Map(
						(state.facets?.status ?? []).flatMap((x) =>
							x.value ? [[x.value, x.count] as const] : []
						)
					);
		return [
			{
				id: 'status',
				label: 'Stand',
				kind: 'list',
				options: COMMITMENT_STATUSES.filter(
					(st) => !counts || (counts.get(st) ?? 0) > 0 || st === p.commitmentStatus
				).map((st) => ({
					id: st,
					label: st,
					count: counts?.get(st),
					on: p.commitmentStatus === st,
					onClick: toggle(patch, 'status', p.commitmentStatus, st)
				}))
			},
			{
				id: 'overdue',
				label: 'Termijn',
				kind: 'list',
				options: [
					{
						id: 'overdue',
						label: 'Open en over de verwachte datum',
						on: p.overdue,
						onClick: flag(patch, 'overdue', p.overdue)
					}
				]
			},
			{
				id: 'cabinet',
				label: 'Kabinet',
				kind: 'select',
				value: p.cabinet,
				all: 'Alle kabinetten',
				options: shared.cabinets
					.filter((c) => c.commitments > 0 || c.key === p.cabinet)
					.map((c) => ({ value: c.key, label: c.name, count: c.commitments })),
				onChange: (v) => patch({ kabinet: v || null })
			},
			{
				id: 'ministry',
				label: 'Ministerie',
				kind: 'select',
				value: p.ministry,
				all: 'Alle ministeries',
				options: shared.ministries
					.filter((m) => !m.until || m.key === p.ministry)
					.map((m) => ({ value: m.key, label: m.name })),
				onChange: (v) => patch({ ministerie: v || null })
			},
			...(p.member
				? [
						{
							id: 'member',
							label: 'Bewindspersoon',
							kind: 'list' as const,
							options: [
								{
									id: p.member,
									label:
										page?.items.find((c) => c.member?.key === p.member)?.member?.name ??
										'Gekozen bewindspersoon',
									on: true,
									onClick: () => patch({ persoon: null })
								}
							]
						}
					]
				: [])
		];
	},
	Rows: CommitmentRows
});
