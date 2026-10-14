import { describe, expect, it } from 'vitest';
import {
	capitalize,
	count,
	escapeRegExp,
	joinAnd,
	joinParts,
	lowerFirst,
	plural,
	separatorBefore,
	textOf,
	truncate,
	withoutGroup
} from './words';

describe('textOf', () => {
	it.each([
		['  Hoge Raad ', 'Hoge Raad'],
		['', null],
		['   ', null],
		[null, null],
		[undefined, null],
		[42, null],
		[['a'], null]
	])('%j gives %j', (value, expected) => {
		expect(textOf(value)).toBe(expected);
	});
});

describe('capitalize and lowerFirst', () => {
	it.each([
		['van den Berg', 'Van den Berg'],
		['motie', 'Motie'],
		['Al groot', 'Al groot'],
		['', '']
	])('capitalizes %j', (s, expected) => expect(capitalize(s)).toBe(expected));
	it.each([
		['Minister van Financiën', 'minister van Financiën'],
		['', '']
	])('lowers %j', (s, expected) => expect(lowerFirst(s)).toBe(expected));
});

describe('plural and count', () => {
	it.each([
		[0, 'zetels'],
		[1, 'zetel'],
		[22, 'zetels']
	])('%i zetel(s)', (n, word) => {
		expect(plural(n, 'zetel', 'zetels')).toBe(word);
		expect(count(n, 'zetel', 'zetels')).toBe(`${n} ${word}`);
	});
});

describe('joinParts', () => {
	it('leaves an empty part out, also the first', () => {
		expect(joinParts([null, 'Hoge Raad'])).toBe('Hoge Raad');
		expect(joinParts(['Uitspraak', '', '  ', 'Hoge Raad'])).toBe('Uitspraak, Hoge Raad');
		expect(joinParts(['Commissie', undefined, false, 'Tweede Kamer'])).toBe(
			'Commissie, Tweede Kamer'
		);
	});

	it('gives nothing for nothing, keeps a number, and takes its own separator', () => {
		expect(joinParts([null, undefined])).toBe('');
		expect(joinParts(['Bijlage', 2])).toBe('Bijlage, 2');
		expect(joinParts(['a', null, 'b'], '; ')).toBe('a; b');
	});
});

describe('joinAnd', () => {
	it.each([
		[[], ''],
		[['1'], '1'],
		[['1', '7'], '1 en 7'],
		[['1', '2', '3'], '1, 2 en 3']
	])('%j reads %j', (parts, expected) => expect(joinAnd(parts)).toBe(expected));

	it('counts the others with the noun of the place, and a comma before them', () => {
		const andere = { one: 'ander', many: 'andere' };
		const anderen = { one: 'ander', many: 'anderen' };
		expect(joinAnd(['A', 'B'], { n: 4, ...andere })).toBe('A, B en 4 andere');
		expect(joinAnd(['A'], { n: 1, ...anderen })).toBe('A en 1 ander');
		expect(joinAnd(['A', 'B'], { n: 3, ...anderen })).toBe('A, B en 3 anderen');
		expect(joinAnd(['A', 'B'], { n: 0, ...andere })).toBe('A en B');
	});
});

describe('separatorBefore', () => {
	it('puts nothing, a comma or "en" before a name; a comma before the others', () => {
		expect([0, 1, 2].map((i) => separatorBefore(i, 3))).toEqual(['', ', ', ' en ']);
		expect([0, 1].map((i) => separatorBefore(i, 2, true))).toEqual(['', ', ']);
	});
});

describe('withoutGroup', () => {
	it.each([
		['Motie (gewijzigd/nader)', 'Motie'],
		['Brief regering (Kamerbrief)  ', 'Brief regering'],
		['Amendement', 'Amendement'],
		['Wet (a) en (b)', 'Wet']
	])('%j gives %j', (kind, expected) => expect(withoutGroup(kind)).toBe(expected));
});

describe('truncate', () => {
	it('leaves a text within its length alone', () => {
		expect(truncate('Wet op de rechterlijke organisatie', 80)).toBe(
			'Wet op de rechterlijke organisatie'
		);
		expect(truncate('abcde', 5)).toBe('abcde');
	});

	it('cuts within the length, "…" included', () => {
		expect(truncate('abcdefghij', 5)).toBe('abcd…');
		expect(truncate('abc   defghij', 7)).toBe('abc…');
	});

	it('cuts at a word, past half the length, without a comma before "…"', () => {
		const long = 'Regels over de bescherming van persoonsgegevens, en over de toezichthouder';
		const cut = truncate(long, 60, { atWord: true });
		expect(cut).toBe('Regels over de bescherming van persoonsgegevens, en over…');
		expect(cut.length).toBeLessThanOrEqual(60);
		expect(truncate('Regels over de bescherming, van', 30, { atWord: true })).toBe(
			'Regels over de bescherming…'
		);
		expect(truncate('Kort eenheelheellangwoordzonderspaties', 20, { atWord: true })).toBe(
			'Kort eenheelheellan…'
		);
	});
});

describe('escapeRegExp', () => {
	it('matches a text literally', () => {
		const s = 'art. 6:162 (a+b)? [c] {d} ^e$ |f\\';
		expect(new RegExp(escapeRegExp(s)).test(`zie ${s} hier`)).toBe(true);
		expect(new RegExp(`^${escapeRegExp('a.c')}$`).test('abc')).toBe(false);
	});
});
