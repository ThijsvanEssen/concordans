import { describe, expect, it } from 'vitest';
import {
	grondslagKopregel,
	grondslagWerkwoord,
	uitgewerktIn,
	artikelKort,
	delegatiesWithin,
	grondslagKop,
	nogGeen,
	regelingNaam,
	regelingRegel,
	vullingVan,
	type Delegatie,
	type Gedelegeerd,
	type Regeling
} from './delegaties';
import { regelingRow } from '$lib/verbonden/loaders';

// Cyberbeveiligingswet art. 16: lid 1 delegates to an AMvB, lid 7 too; art. 44 lid 3 has none.
const formule = (start: number, lid: string | null, kind: Delegatie['kind'] = 'amvb') => ({
	start,
	end: start + 48,
	text: 'Bij of krachtens algemene maatregel van bestuur',
	kind,
	krachtens: true,
	part: lid ? `lid-${lid}` : null,
	lid
});

const besluit: Regeling = {
	instrument: {
		celex: null,
		short_title: null,
		abbreviation: null,
		official_url: null,
		judgment_count: null,
		outbound_citation_count: null,
		id: 'instruments/bwbr0052875',
		key: 'bwbr0052875',
		bwb_id: 'BWBR0052875',
		title: 'Cyberbeveiligingsbesluit',
		citation_title: 'Cyberbeveiligingsbesluit',
		display_name: 'Cyberbeveiligingsbesluit',
		article_count: 36,
		inbound_citation_count: 0,
		path: null
	},
	kind: 'amvb',
	date_in_force: '2026-08-15',
	basis_kind: null,
	text: '16, eerste en zevende lid',
	leden: ['1', '7'],
	onderdelen: [],
	aanhef: false,
	articles: [
		{
			id: 'articles/bwbr0052875_2',
			key: 'bwbr0052875_2',
			article_number: '2',
			display_name: 'Artikel 2 Cyberbeveiligingsbesluit',
			leden: ['1'],
			onderdelen: [],
			aanhef: false
		}
	]
};

const antwoord: Gedelegeerd = {
	article_id: 'articles/bwbr0052872_16',
	clauses: [
		{ ...formule(3, '1'), instruments: ['bwbr0052875'] },
		{ ...formule(900, '3'), instruments: [] }
	],
	items: [besluit],
	total: 1
};

describe('delegation formulas', () => {
	it('keeps the formulas of a part, relative to it, with their place in the article', () => {
		const spans = delegatiesWithin([formule(3, '1'), formule(900, '3')], 0, 200);
		expect(spans).toHaveLength(1);
		expect(spans[0]).toMatchObject({ start: 3, end: 51, bij: 3 });
		expect(delegatiesWithin([formule(900, '3')], 890, 100)[0]).toMatchObject({
			start: 10,
			bij: 900
		});
	});

	it('names the regulations that fill a formula, or none yet', () => {
		expect(vullingVan(antwoord, 3)).toEqual([besluit]);
		expect(vullingVan(antwoord, 900)).toEqual([]);
		expect(vullingVan(antwoord, 5)).toBeNull();
	});

	it('says what is missing in the words of the formula', () => {
		expect(nogGeen({ kind: 'amvb' })).toBe('Nog geen AMvB op deze grondslag');
		expect(nogGeen({ kind: 'ministeriele_regeling' })).toBe(
			'Nog geen ministeriële regeling op deze grondslag'
		);
		expect(grondslagKop({ lid: '1' })).toBe('Grondslag, lid 1');
		expect(grondslagKop({ lid: null })).toBe('Grondslag');
	});

	it('names a regulation by its title, kind and day, and its articles short', () => {
		expect(regelingNaam(besluit)).toBe('Cyberbeveiligingsbesluit');
		expect(regelingRegel(besluit)).toBe('AMvB, 15 augustus 2026');
		expect(regelingRegel({ ...besluit, kind: 'ministeriele-regeling', date_in_force: null })).toBe(
			'Ministeriële regeling'
		);
		expect(artikelKort(besluit.articles![0])).toBe('art. 2');
	});

	it('gives a row of Verbonden: the regulation, its day, the lid its Gelet op names', () => {
		const row = regelingRow({ ...besluit, leden: ['1'] });
		expect(row).toMatchObject({
			ref: { collection: 'instruments', key: 'bwbr0052875' },
			title: 'Cyberbeveiligingsbesluit',
			// The kind stands in the line, `AMvB op grond van lid 1` (hoe.ts).
			context: null,
			identifier: 'in werking 15 aug. 2026',
			date: '2026-08-15',
			lid: '1',
			relation: 'BASED_ON',
			direction: 'inbound'
		});
		expect(regelingRow(besluit).lid).toBeNull();
	});
});

describe('the grondslag of a regulation', () => {
	const wet = (key: string, title: string, basis_kind: 'delegates' | 'mentioned' | null) => ({
		instrument: {
			id: `instruments/${key}`,
			key,
			bwb_id: key.toUpperCase(),
			title,
			citation_title: title,
			display_name: title,
			article_count: 1,
			inbound_citation_count: 0,
			celex: null,
			short_title: null,
			abbreviation: null,
			official_url: null,
			judgment_count: null,
			outbound_citation_count: null,
			path: null
		},
		basis_kind
	});

	it('says in the head under which laws it is made, then those it only names', () => {
		expect(
			grondslagKopregel([
				wet('bwbr0052872', 'Cyberbeveiligingswet', 'delegates'),
				wet('bwbr0026338', 'Drinkwaterwet', null),
				wet('bwbr0005537', 'Algemene wet bestuursrecht', 'mentioned')
			]).map((d) => [d.werkwoord, d.wetten.map((w) => w.naam)])
		).toEqual([
			['Op grond van', ['Cyberbeveiligingswet', 'Drinkwaterwet']],
			['Noemt in de aanhef', ['Algemene wet bestuursrecht']]
		]);
		expect(grondslagKopregel([])).toEqual([]);
	});

	it('names the kind of what is issued, and a preamble that only names the article', () => {
		expect(grondslagWerkwoord('amvb')).toBe('AMvB op grond van');
		expect(grondslagWerkwoord('beleidsregel', 'mentioned')).toBe('Beleidsregel noemt in de aanhef');
		expect(grondslagWerkwoord(null)).toBe('Op grond van');
	});

	it('names the articles that work it out, the rest counted', () => {
		const a = (n: string) => ({ article_number: n });
		expect(uitgewerktIn([a('2'), a('3')])).toBe('uitgewerkt in art. 2 en 3');
		expect(uitgewerktIn(['1', '2', '3', '4', '5', '6', '7', '8'].map(a))).toBe(
			'uitgewerkt in art. 1, 2, 3, 4, 5, 6 en 2 andere'
		);
		expect(uitgewerktIn([])).toBeNull();
	});
});
