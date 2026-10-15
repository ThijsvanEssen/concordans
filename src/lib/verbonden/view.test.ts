import { describe, expect, it } from 'vitest';
import { EMPTY_FILTER, hiddenByKind } from './filter';
import type { Group } from './groups';
import type { Row } from './rows';
import {
	countLine,
	filterGroups,
	lidTellingenOnder,
	regroup,
	vasteGroepen,
	yearHistogram
} from './view';

const row = (over: Partial<Row>): Row => ({
	ref: { collection: 'judgments', key: 'j' },
	title: 'Hof Amsterdam',
	context: null,
	kind: 'uitspraken',
	...over
});

// Artikel 3:4 Awb on prod, API 0.79.17.
const per = new Map([
	[
		'articles',
		new Map([
			['', 7],
			['2', 4]
		])
	],
	[
		'documents',
		new Map([
			['', 48],
			['1', 7],
			['2', 19]
		])
	],
	[
		'judgments',
		new Map([
			['', 3052],
			['1', 874],
			['2', 3321]
		])
	]
]);

describe('lidTellingenOnder', () => {
	it('adds every bucket without a bronfilter', () => {
		expect(lidTellingenOnder(per, null)?.get('2')).toBe(3344);
	});

	it('adds the buckets of the kinds that are on', () => {
		const counts = lidTellingenOnder(per, new Set(['uitspraken']));
		expect([counts?.get('1'), counts?.get('2')]).toEqual([874, 3321]);
		expect(lidTellingenOnder(per, new Set(['uitspraken', 'artikelen']))?.get('2')).toBe(3325);
	});

	it('leaves it to the rows where the filter splits the stukken of one bucket', () => {
		expect(lidTellingenOnder(per, new Set(['toelichtingen']))).toBeNull();
		const stukken = lidTellingenOnder(
			per,
			new Set(['toelichtingen', 'wetsvoorstellen', 'dossiers'])
		);
		expect(stukken?.get('2')).toBe(19);
	});
});

describe('the panel under the filter', () => {
	const groups: Group[] = [
		{
			id: 'judgments',
			label: 'Uitspraken die dit artikel aanhalen',
			rows: [
				row({ date: '2024-01-01', lid: '2' }),
				row({ ref: { collection: 'judgments', key: 'k' }, date: '2023-01-01', lid: '1' })
			],
			total: 1064,
			capped: false
		},
		{
			id: 'cited-by',
			label: 'Artikelen die naar dit artikel verwijzen',
			rows: [row({ ref: { collection: 'articles', key: 'a' }, kind: 'artikelen', lid: '2' })],
			total: 34,
			capped: false
		}
	];

	it('counts what is shown and what is hidden, and never leaves an empty panel silent', () => {
		expect(countLine(groups, EMPTY_FILTER)).toBe('1.098 verbindingen');
		const f = { ...EMPTY_FILTER, bronnen: new Set(['artikelen'] as const) };
		expect(countLine(groups, f)).toBe('34 van 1.098 verbindingen');
		// A group the API cut off without a total: the sum is at least.
		const afgekapt = [
			...groups,
			{ ...groups[groups.length - 1], id: 'x', total: undefined, capped: true }
		];
		expect(countLine(afgekapt, EMPTY_FILTER)).toBe('1.099+ verbindingen');
		expect(filterGroups(groups, f).map((g) => g.id)).toEqual(['cited-by']);
		expect(
			hiddenByKind(
				groups.flatMap((g) => g.rows),
				{ uitspraken: 1064 },
				f
			)
		).toEqual([{ kind: 'uitspraken', count: 1064 }]);
		const none = { ...EMPTY_FILTER, bronnen: new Set(['dossiers'] as const) };
		expect(filterGroups(groups, none)).toEqual([]);
	});

	it('writes one count, once it holds (UX-toets 0.79.47, #56)', () => {
		const leden = { ...groups[1], id: 'members', total: 300 };
		const dossiers = { id: 'dossiers', label: 'Dossiers', rows: [], capped: false };
		const activiteiten = { id: 'activities', label: 'Activiteiten', rows: [], capped: false };
		const alle = [leden, dossiers, activiteiten];
		// A waiting group the node cannot foretell: no count yet.
		expect(vasteGroepen(alle, ['dossiers', 'activities'], { activities: 4493 })).toBeNull();
		// Dossiers in, the activities foretold: the count it will have.
		const binnen = [leden, { ...dossiers, rows: [groups[1].rows[0]], total: 611 }, activiteiten];
		const vast = vasteGroepen(binnen, ['activities'], { activities: 4493 })!;
		const wacht = new Set(['activities']);
		expect(countLine(vast, EMPTY_FILTER, wacht)).toBe('5.404 verbindingen');
		// The same once the activities are in.
		const klaar = [...binnen.slice(0, 2), { ...activiteiten, rows: [row({})], total: 4493 }];
		expect(countLine(vasteGroepen(klaar)!, EMPTY_FILTER)).toBe('5.404 verbindingen');
	});

	it('keeps a group whose loader is still under way in its place, unless a filter cuts rows', () => {
		const wachtend = [
			{ id: 'judgments', label: 'Uitspraken die dit artikel aanhalen', rows: [], capped: false },
			groups[1]
		];
		const shown = filterGroups(wachtend, EMPTY_FILTER, new Set(['judgments']));
		expect(shown.map((g) => [g.id, !!g.laden])).toEqual([
			['judgments', true],
			['cited-by', false]
		]);
		expect(filterGroups(wachtend, EMPTY_FILTER).map((g) => g.id)).toEqual(['cited-by']);
		const f = { ...EMPTY_FILTER, bronnen: new Set(['artikelen'] as const) };
		expect(filterGroups(wachtend, f, new Set(['judgments'])).map((g) => g.id)).toEqual([
			'cited-by'
		]);
	});

	it('regroups per lid, the rest under Hele artikel', () => {
		const perLid = regroup(
			[
				...groups,
				{
					id: 'law',
					label: 'Wet',
					rows: [row({ ref: { collection: 'instruments', key: 'w' }, kind: 'wetten' })],
					capped: false
				}
			],
			'lid',
			'articles'
		);
		expect(perLid.map((g) => g.label)).toEqual(['Lid 1', 'Lid 2', 'Hele artikel']);
		expect(perLid[1].rows).toHaveLength(2);
	});

	it('counts judgments per year for the bar chart', () => {
		const bars = yearHistogram(groups[0].rows, 3);
		expect(bars.map((b) => b.year)).toEqual([2022, 2023, 2024]);
		expect(bars.map((b) => b.count)).toEqual([0, 1, 1]);
	});
});
