import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { ministryOrder, sideBySideRows, type CabinetSeat } from './side-by-side';
import type { Ministry } from './government';

// The ministries as /api/ministries gives them: protocol order, a renamed one under its
// successor.
const MINISTRIES: Ministry[] = [
	{
		abbreviation: null,
		tooi: null,
		path: null,
		successor: null,
		until: null,
		periods: [],
		path: null,
		key: 'az',
		name: 'Algemene Zaken'
	},
	{
		abbreviation: null,
		tooi: null,
		path: null,
		successor: null,
		until: null,
		periods: [],
		path: null,
		key: 'bz',
		name: 'Buitenlandse Zaken'
	},
	{
		abbreviation: null,
		tooi: null,
		path: null,
		successor: null,
		until: null,
		periods: [],
		path: null,
		key: 'jenv',
		name: 'Justitie en Veiligheid'
	},
	{
		abbreviation: null,
		tooi: null,
		path: null,
		until: null,
		periods: [],
		path: null,
		key: 'venj',
		name: 'Veiligheid en Justitie',
		successor: 'jenv'
	},
	{
		abbreviation: null,
		tooi: null,
		path: null,
		until: null,
		periods: [],
		path: null,
		key: 'justitie',
		name: 'Justitie',
		successor: 'venj'
	},
	{
		abbreviation: null,
		tooi: null,
		path: null,
		successor: null,
		until: null,
		periods: [],
		path: null,
		key: 'ezk',
		name: 'Economische Zaken en Klimaat'
	},
	{
		abbreviation: null,
		tooi: null,
		path: null,
		until: null,
		periods: [],
		path: null,
		key: 'ez',
		name: 'Economische Zaken',
		successor: 'ezk'
	},
	{
		abbreviation: null,
		tooi: null,
		path: null,
		until: null,
		periods: [],
		path: null,
		key: 'eli',
		name: 'Economische Zaken, Landbouw en Innovatie',
		successor: 'ez'
	},
	{
		abbreviation: null,
		tooi: null,
		path: null,
		successor: null,
		until: null,
		periods: [],
		path: null,
		key: 'lvvn',
		name: 'Landbouw, Visserij, Voedselzekerheid en Natuur'
	},
	{
		abbreviation: null,
		tooi: null,
		path: null,
		until: null,
		periods: [],
		path: null,
		key: 'lnv',
		name: 'Landbouw, Natuur en Voedselkwaliteit',
		successor: 'lvvn'
	}
];

type Detail = Schema<'CabinetDetailDTO'>;
const post = (member: string) => ({ member: { key: member } }) as CabinetSeat['posts'][number];

const seat = (ministry: string, p: string, member: string, portfolio: string | null = null) => ({
	seat: portfolio ? `-/${p}/${portfolio}` : `${ministry}/${p}`,
	post: p as 'minister',
	portfolio,
	posts: [post(member)]
});

const cabinet = (key: string, ministries: [string, string, ReturnType<typeof seat>[]][]): Detail =>
	({
		key,
		name: `kabinet-${key}`,
		ministries: ministries.map(([ministry, name, seats]) => ({ ministry, name, seats }))
	}) as Detail;

const rutte2 = cabinet('rutte_ii', [
	['venj', 'Veiligheid en Justitie', [seat('venj', 'minister', 'opstelten')]],
	['az', 'Algemene Zaken', [seat('az', 'minister-president', 'rutte')]],
	['ez', 'Economische Zaken', [seat('ez', 'minister', 'kamp')]]
]);
const rutte3 = cabinet('rutte_iii', [
	['az', 'Algemene Zaken', [seat('az', 'minister-president', 'rutte')]],
	['ezk', 'Economische Zaken en Klimaat', [seat('ezk', 'minister', 'wiebes')]],
	[
		'jenv',
		'Justitie en Veiligheid',
		[
			seat('jenv', 'minister', 'grapperhaus'),
			seat('jenv', 'minister_zonder_portefeuille', 'dekker', 'rechtsbescherming'),
			seat('jenv', 'staatssecretaris', 'broekers')
		]
	],
	['bz', 'Buitenlandse Zaken', [seat('bz', 'minister', 'blok', 'buitenlandse-handel')]]
]);

const members = (cells: ({ posts: { member: { key: string } }[] } | null)[]) =>
	cells.map((c) => c?.posts.map((p) => p.member.key) ?? null);

describe('ministryOrder', () => {
	it('follows a renamed ministry to the one of today, and ranks it there', () => {
		const { current, rank, name } = ministryOrder(MINISTRIES);
		expect(current('justitie')).toBe('jenv');
		expect(current('eli')).toBe('ezk');
		expect(current('lnv')).toBe('lvvn');
		expect(current('az')).toBe('az');
		expect(rank('venj')).toBe(rank('jenv'));
		expect(rank('az')).toBeLessThan(rank('bz'));
		expect(rank('nieuw')).toBe(MINISTRIES.length);
		expect(name('venj')).toBe('Justitie en Veiligheid');
	});
});

describe('sideBySideRows', () => {
	const rows = sideBySideRows([rutte2, rutte3], MINISTRIES, (s) => ({ posts: s.posts }));

	it('keeps a renamed ministry on one row, under the name of the newest cabinet', () => {
		const justice = rows.find((r) => r.key === 'jenv/minister')!;
		expect(justice.title).toBe('Justitie en Veiligheid');
		expect(members(justice.cells)).toEqual([['opstelten'], ['grapperhaus']]);
		const economy = rows.find((r) => r.key === 'ezk/minister')!;
		expect(members(economy.cells)).toEqual([['kamp'], ['wiebes']]);
	});

	it('stands in protocol order, the minister-president first', () => {
		expect(rows.map((r) => r.key)).toEqual([
			'az/minister-president',
			'jenv/minister',
			'ezk/minister'
		]);
		expect(rows[0].primeMinister).toBe(true);
	});

	it('leaves out the staatssecretarissen and the ministers with a portfolio', () => {
		expect(rows.some((r) => r.key.endsWith('staatssecretaris'))).toBe(false);
		expect(rows.some((r) => r.key.startsWith('bz/'))).toBe(false);
	});

	it('leaves out a column whose cabinet is not in, and a seat its cell drops', () => {
		const some = sideBySideRows([null, rutte3], MINISTRIES, (s) =>
			s.posts.some((p) => p.member.key === 'wiebes') ? { posts: s.posts } : null
		);
		expect(some.map((r) => r.key)).toEqual(['ezk/minister']);
		expect(members(some[0].cells)).toEqual([null, ['wiebes']]);
	});
});
