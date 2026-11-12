import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import {
	formerTitles,
	movedSeat,
	seatHref,
	seatName,
	seatGroups,
	seatOf,
	seatTitle,
	stints,
	timeline
} from './office';

type Holder = Schema<'SeatHolderDTO'>;

const holder = (name: string, from: string, to: string | null, fn: string): Holder => ({
	member: { key: name, name, path: null } as Holder['member'],
	seat: 'jenv/minister',
	post: 'minister',
	function: fn,
	ministry: 'jenv',
	cabinet_key: null,
	cabinet_name: null,
	from_date: from,
	to_date: to,
	acting: false,
	overlaps_with: [],
	ministry_name: null
});

const holders = [
	holder('A', '2010-10-14', '2017-10-26', 'Minister van Veiligheid en Justitie'),
	holder('B', '2017-10-26', '2022-01-10', 'Minister van Justitie en Veiligheid'),
	holder('C', '2022-01-10', null, 'minister van Justitie en Veiligheid')
];

describe('an office', () => {
	it('has an address of its seat, a portfolio a segment of its own', () => {
		expect(seatHref('jenv/minister')).toBe('/ambten/jenv/minister');
		expect(seatHref('-/minister/werk-en-participatie')).toBe(
			'/ambten/-/minister/werk-en-participatie'
		);
		expect(seatOf('jenv', 'minister', undefined)).toBe('jenv/minister');
		expect(seatOf('-', 'minister', 'werk-en-participatie')).toBe('-/minister/werk-en-participatie');
	});

	it('is named by its latest holder, the names before it oldest first', () => {
		const seat = { seat: 'jenv/minister', holders };
		expect(seatTitle(seat)).toBe('Minister van Justitie en Veiligheid');
		expect(formerTitles(seat)).toEqual(['Minister van Veiligheid en Justitie']);
		expect(seatTitle({ seat: 'x/minister', holders: [] })).toBe('x/minister');
	});

	it('is named by its seat where no holder names it', () => {
		const name = (k: string) => ({ venw: 'Verkeer en Waterstaat' })[k] ?? k;
		expect(seatName('venw/minister', name)).toBe('Minister van Verkeer en Waterstaat');
		expect(seatName('az/minister-president', name)).toBe('Minister-president');
		expect(seatName('-/minister/werk-en-participatie', name)).toBe(
			'Minister voor werk en participatie'
		);
		expect(seatName('minister/werk-en-participatie', name)).toBe(
			'Minister voor werk en participatie'
		);
		expect(seatName('minister_zonder_portefeuille', name)).toBe('Minister');
		expect(seatName('-/minister_zonder_portefeuille', name)).toBe('Minister');
		expect(seatName('viceminister-president', name)).toBe('viceminister-president');
		expect(seatName('jenv/staatssecretaris', name)).toBe('jenv/staatssecretaris');
	});

	it('lists holders and gaps newest first, a gap where it fell', () => {
		const line = timeline(holders, [{ from_date: '2001-01-01', to_date: '2010-10-14' }]);
		expect(line.map((e) => (e.kind === 'gap' ? 'gat' : e.stint.member.name))).toEqual([
			'C',
			'B',
			'A',
			'gat'
		]);
	});

	it('takes the posts of one person that follow each other as one stretch', () => {
		const one = [
			{
				...holder('D', '2002-07-22', '2003-05-27', 'Minister van Justitie'),
				cabinet_key: 'b1',
				cabinet_name: 'kabinet-Balkenende I'
			},
			{
				...holder('D', '2003-05-27', '2006-07-07', 'Minister van Justitie'),
				cabinet_key: 'b2',
				cabinet_name: 'kabinet-Balkenende II'
			},
			{
				...holder('E', '2006-07-07', '2006-09-21', 'Minister van Justitie'),
				cabinet_key: 'b3',
				cabinet_name: 'kabinet-Balkenende III'
			},
			{
				...holder('D', '2007-02-22', null, 'Minister van Justitie'),
				cabinet_key: 'b4',
				cabinet_name: 'kabinet-Balkenende IV'
			}
		];
		const s = stints(one);
		expect(
			s.map((x) => [x.member.name, x.from_date, x.to_date, x.cabinets.map((c) => c.key)])
		).toEqual([
			['D', '2002-07-22', '2006-07-07', ['b1', 'b2']],
			['E', '2006-07-07', '2006-09-21', ['b3']],
			['D', '2007-02-22', null, ['b4']]
		]);
	});
});

describe('the offices per ministry', () => {
	const seat = (
		seat: string,
		post: string,
		ministry: string | null,
		held: boolean,
		to_date: string | null = null
	) =>
		({
			seat,
			post,
			function: seat,
			ministry,
			ministry_name:
				ministry &&
				{ az: 'Algemene Zaken', fin: 'Financiën', bz: 'Buitenlandse Zaken', oorlog: 'Oorlog' }[
					ministry
				],
			from_date: '2020-01-01',
			to_date,
			holder_count: 1,
			current: held ? [{ member: { key: 'x', name: 'X' } }] : []
		}) as Schema<'SeatSummaryDTO'>;

	it('puts Algemene Zaken first, the held ministries by name, the former ones, then those of none', () => {
		const groups = seatGroups([
			seat('minister/wonen', 'minister_zonder_portefeuille', null, true),
			seat('oorlog/minister', 'minister', 'oorlog', false, '1959-01-01'),
			seat('fin/minister', 'minister', 'fin', true),
			seat('bz/minister', 'minister', 'bz', true),
			seat('az/minister-president', 'minister-president', 'az', true)
		]);
		expect(groups.map((g) => g.ministry)).toEqual(['az', 'bz', 'fin', 'oorlog', null]);
	});

	it('lists the offices held today first, the minister before the staatssecretarissen, then the latest ended', () => {
		const [fin] = seatGroups([
			seat('fin/staatssecretaris/toeslagen', 'staatssecretaris', 'fin', false, '2024-07-02'),
			{
				...seat('fin/staatssecretaris/herstel', 'staatssecretaris', 'fin', true),
				from_date: '2026-02-23'
			},
			seat('fin/staatssecretaris', 'staatssecretaris', 'fin', true),
			seat('fin/staatssecretaris/fiscaliteit', 'staatssecretaris', 'fin', false, '2026-02-23'),
			seat('fin/minister', 'minister', 'fin', true)
		]);
		expect(fin.seats.map((s) => s.seat)).toEqual([
			'fin/minister',
			'fin/staatssecretaris',
			'fin/staatssecretaris/herstel',
			'fin/staatssecretaris/fiscaliteit',
			'fin/staatssecretaris/toeslagen'
		]);
	});

	it('finds the office an old key without a ministry names under its ministry', () => {
		const seats = [{ seat: 'fin/staatssecretaris/fiscaliteit-en-belastingdienst' }];
		expect(movedSeat('staatssecretaris/fiscaliteit-en-belastingdienst', seats)).toBe(
			'fin/staatssecretaris/fiscaliteit-en-belastingdienst'
		);
		expect(movedSeat('staatssecretaris/onbekend', seats)).toBeNull();
	});
});
