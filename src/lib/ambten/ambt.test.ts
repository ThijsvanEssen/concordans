import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import {
	formerTitles,
	ministerSeats,
	seatHref,
	seatName,
	seatOf,
	seatTitle,
	stints,
	timeline
} from './ambt';

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
		expect(seatName('viceminister-president', name)).toBe('viceminister-president');
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

describe('the ministers of a cabinet', () => {
	it('lists the seats of the ministers, a lane and the staatssecretarissen left out', () => {
		const post = (name: string) => ({ member: { key: name, name } }) as Schema<'CabinetPostDTO'>;
		const seats = ministerSeats({
			ministries: [
				{
					ministry: 'bz',
					name: 'Buitenlandse Zaken',
					seats: [
						{
							seat: 'bz/minister',
							post: 'minister',
							function: 'Minister van Buitenlandse Zaken',
							portfolio: null,
							posts: [post('X')]
						},
						{
							seat: 'bz/staatssecretaris#2',
							post: 'staatssecretaris',
							function: 'Staatssecretaris',
							portfolio: null,
							posts: [post('Y')]
						}
					]
				},
				{
					ministry: null,
					name: null,
					seats: [
						{
							seat: 'viceminister-president',
							post: 'viceminister-president',
							function: 'viceminister-president',
							portfolio: null,
							posts: [post('Z')]
						}
					]
				}
			]
		} as Schema<'CabinetDetailDTO'>);
		expect(seats).toEqual([
			{ seat: 'bz/minister', title: 'Minister van Buitenlandse Zaken', holders: ['X'] }
		]);
	});
});
