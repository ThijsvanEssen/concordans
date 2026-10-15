import { describe, expect, it } from 'vitest';
import { keuzesOf, lawAbbreviation, lawTitle, resolvedOf } from './resolve-query';

describe('lawAbbreviation', () => {
	it('takes one short word with a capital as a possible abbreviation of a law', () => {
		expect(lawAbbreviation('AVG')).toBe('AVG');
		expect(lawAbbreviation(' Awb ')).toBe('Awb');
		expect(lawAbbreviation('stikstof')).toBeNull();
		expect(lawAbbreviation('Wet open overheid')).toBeNull();
	});
});

describe('lawTitle', () => {
	it('knows a regeling by its title', () => {
		for (const q of [
			'Omgevingswet',
			'Handelsregisterwet 2007',
			'Wet op de rechterlijke organisatie',
			'Wetboek van Strafvordering',
			'Besluit bouwwerken leefomgeving'
		])
			expect(lawTitle(q)).toBe(q);
	});

	it('leaves words, a lone "wet" and citations to the search', () => {
		for (const q of ['huurrecht', 'wet', 'ontslag op staande voet', 'art. 3:4 Awb'])
			expect(lawTitle(q)).toBeNull();
	});
});

describe('resolvedOf', () => {
	const answer = (
		kind: string,
		collection: string,
		key: string,
		display_name: string,
		path: string | null = null
	) =>
		({
			q: 'x',
			kind,
			confidence: 1,
			match: {
				id: `${collection}/${key}`,
				key,
				collection,
				kind,
				display_name,
				confidence: 1,
				path
			},
			alternatives: [],
			qualifier: null
		}) as unknown as Parameters<typeof resolvedOf>[0];

	it('names an article as it is cited, a dossier by the number of its address', () => {
		expect(
			resolvedOf(
				answer('article', 'articles', 'bwbr0005289_162', 'Artikel 162 Burgerlijk Wetboek Boek 6')
			)
		).toEqual({
			ref: { collection: 'articles', key: 'bwbr0005289_162' },
			at: null,
			label: 'Artikel 6:162 BW'
		});
		const dossier = answer(
			'dossier',
			'dossiers',
			'21501_31',
			'Kamerstukdossier 21501-31: Raad',
			'/dossiers/21501-31'
		);
		expect(resolvedOf(dossier)).toEqual({
			ref: { collection: 'dossiers', key: '21501_31', number: '21501-31' },
			at: null,
			label: null
		});
		expect(resolvedOf(null)).toBeNull();
	});
});

describe('keuzesOf', () => {
	const art = (book: string, key: string) => ({
		id: `articles/${key}`,
		key,
		collection: 'articles',
		kind: 'article',
		display_name: `Artikel 3 Burgerlijk Wetboek Boek ${book}`,
		confidence: 0.4
	});
	const ambiguous = {
		q: 'artikel 3 bw lid 2',
		kind: 'article',
		confidence: 0.4,
		match: null,
		alternatives: [art('1', 'bwbr0002656_3'), art('3', 'bwbr0005291_3')],
		qualifier: 'tweede lid'
	} as unknown as Parameters<typeof keuzesOf>[0];

	it('lists every article a citation can mean, in order, with its lid', () => {
		expect(keuzesOf(ambiguous)).toEqual({
			items: [
				{
					ref: { collection: 'articles', key: 'bwbr0002656_3' },
					at: 'lid-2',
					label: 'Artikel 1:3 BW'
				},
				{
					ref: { collection: 'articles', key: 'bwbr0005291_3' },
					at: 'lid-2',
					label: 'Artikel 3:3 BW'
				}
			],
			total: 2
		});
	});

	it('counts the ones left out, and gives nothing beside a match', () => {
		expect(keuzesOf({ ...ambiguous!, alternatives_total: 14 } as never).total).toBe(14);
		expect(keuzesOf({ ...ambiguous!, match: art('6', 'bwbr0005289_3') } as never).items).toEqual(
			[]
		);
		expect(keuzesOf(null).items).toEqual([]);
	});
});

describe('a fractie or lid the API resolves (0.79.30)', () => {
	it('opens the fractie for "VVD", not the regulation with that abbreviation', () => {
		const r = resolvedOf({
			q: 'VVD',
			kind: 'faction',
			confidence: 0.9,
			match: {
				id: 'factions/vvd',
				key: 'vvd',
				collection: 'factions',
				kind: 'faction',
				display_name: 'Volkspartij voor Vrijheid en Democratie',
				confidence: 0.9
			},
			alternatives: []
		} as never);
		expect(r?.ref).toEqual({ collection: 'factions', key: 'vvd' });
		expect(r?.label).toBe('Volkspartij voor Vrijheid en Democratie');
	});
});
