import { describe, expect, it } from 'vitest';
import {
	axisYears,
	busiest,
	countedAs,
	countParts,
	shortCount,
	sumPeriod,
	kindOf,
	perYear,
	stripDate,
	undatedText,
	STRIP_KINDS
} from './strook';
import { rubriekOf } from './rubrieken';

describe('the strip numbers', () => {
	it('counts per year and kind, changes apart', () => {
		const y = perYear(
			[
				{ jaar: 2020.1, collection: 'judgments' },
				{ jaar: 2020.5, collection: 'judgments' },
				{ jaar: 2021.2, collection: 'documents' },
				{ jaar: 2021.9, collection: 'instruments', change: 'Stb. 2021, 1' }
			],
			2020,
			2022
		);
		expect(y.map((a) => a.total)).toEqual([2, 1, 0]);
		expect(y[1].changes).toEqual(['Stb. 2021, 1']);
		expect(busiest(y)).toBe(2);
		const { per, changes } = sumPeriod(y, 2020, 2021);
		expect(countParts(per, changes).map((p) => p.text)).toEqual([
			'2 uitspraken',
			'1 stuk',
			'1 publicatie'
		]);
	});
	it('counts as Tonen: an activiteit under Parlement, a stemming under Kamerstukken (B97)', () => {
		// Dossier 36496: 103 stukken, 42 activiteiten, 41 stemmingen with a day.
		const stippen = [
			...Array.from({ length: 103 }, () => ({ jaar: 2024.5, collection: 'documents' as const })),
			...Array.from({ length: 42 }, () => ({ jaar: 2024.5, collection: 'activities' as const })),
			...Array.from({ length: 41 }, () => ({ jaar: 2024.5, collection: 'decisions' as const }))
		];
		const [year] = perYear(stippen, 2024, 2024);
		expect(year.total).toBe(186);
		expect(year.parts.find((d) => d.id === 'kamerstukken')!.n).toBe(144);
		expect(year.parts.find((d) => d.id === 'parlement')!.n).toBe(42);
		expect(year.words.map((w) => w.text)).toEqual([
			'103 stukken',
			'41 stemmingen',
			'42 activiteiten'
		]);
		expect(new Set(year.words.map((w) => w.colour)).size).toBe(2);
		const { per } = sumPeriod([year], 2024, 2024);
		expect(countParts(per, 0).map((p) => p.text)).toEqual([
			'103 stukken',
			'41 stemmingen',
			'42 activiteiten'
		]);
		expect(shortCount(per, 0, [])).toBe('186 bronnen');
		expect(undatedText(['activities', 'commitments', 'commitments', 'dossiers'])).toBe(
			'zonder datum: 1 dossier, 2 toezeggingen en 1 activiteit'
		);
	});
	it('takes the kind of every collection from the rubriek of Tonen', () => {
		const collections = [
			'instruments',
			'articles',
			'annexes',
			'judgments',
			'documents',
			'dossiers',
			'activities',
			'decisions',
			'cases',
			'commitments',
			'members',
			'factions',
			'committees',
			'cabinets',
			'ministries'
		] as const;
		for (const c of collections) expect(kindOf(c)).toBe(rubriekOf(c, '', null));
		for (const c of collections) {
			const word = perYear([{ jaar: 2024, collection: c }], 2024, 2024)[0].words[0];
			expect(word.colour, c).toBe(STRIP_KINDS.find((k) => k.id === kindOf(c))!.colour);
		}
	});
	it('dates a publication by the day it was published, a law by none', () => {
		const stb = { kind: 'publicatie', date_published: '2024-07-01' };
		expect(stripDate(stb, 'instruments', 'instruments/stb_2024_200')).toBe('2024-07-01');
		expect(
			stripDate({ date_published: '2024-07-01' }, 'instruments', 'instruments/stb_2024_200')
		).toBe('2024-07-01');
		expect(
			stripDate({ kind: 'wet', date_published: '1991-12-18' }, 'instruments', 'instruments/bwbr1')
		).toBeNull();
		expect(stripDate({ date: '2020-02-02' }, 'judgments', 'judgments/x')).toBe('2020-02-02');
	});
	it('says the count of a phone at rest in one short line', () => {
		const per = new Map([
			['uitspraken', 2],
			['stukken', 1]
		] as const);
		expect(shortCount(per, 1, ['documents', 'articles', 'articles'])).toBe(
			'4 bronnen; zonder datum: 3'
		);
		expect(shortCount(new Map([['wetten', 1]]), 0, [])).toBe('1 bron');
		expect(shortCount(new Map(), 0, ['articles'])).toBe('zonder datum: 1');
		expect(shortCount(new Map(), 0, [])).toBe('');
	});
	it('says what has no day by what it is', () => {
		expect(undatedText([])).toBeNull();
		expect(
			undatedText(['documents', ...Array<'articles'>(200).fill('articles'), 'instruments'])
		).toBe('zonder datum: 1 wet, 200 artikelen en 1 stuk');
		expect(undatedText(['articles'])).toBe('zonder datum: 1 artikel');
	});
	it('puts every collection of the canvas in one kind or none', () => {
		expect(kindOf('articles')).toBe('wetten');
		expect(kindOf('judgments')).toBe('rechtspraak');
		expect(kindOf('members')).toBe('parlement');
		expect(kindOf('ministries')).toBe('regering');
	});
	it('counts a bewindspersoon as Regering and a Kamerlid as Parlement', () => {
		const post = { government_functions: [{ from_date: '2020-01-01', to_date: null }] };
		expect(countedAs('members', post)).toBe('ministries');
		expect(countedAs('members', {})).toBe('members');
		expect(undatedText(['ministries', 'cabinets', 'members'])).toBe(
			'zonder datum: 1 parlementsbron en 2 regeringsbronnen'
		);
	});
	it('names the first and last year always and never two names touching', () => {
		for (const width of [200, 343, 900, 1100]) {
			for (const [a, b] of [
				[2007, 2026],
				[1990, 2026],
				[2024, 2026],
				[1838, 2026]
			]) {
				const ax = axisYears(a, b, width);
				expect(ax[0]).toEqual({ jaar: a, align: 'start' });
				expect(ax.at(-1)).toEqual({ jaar: b, align: 'end' });
				const col = width / (b - a + 1);
				const boxes = ax.map((y) => {
					const c = (y.jaar - a + 0.5) * col;
					return y.align === 'start'
						? [0, 30]
						: y.align === 'end'
							? [width - 30, width]
							: [c - 15, c + 15];
				});
				for (let i = 1; i < boxes.length; i++)
					expect(boxes[i][0]).toBeGreaterThanOrEqual(boxes[i - 1][1]);
			}
		}
	});
});
