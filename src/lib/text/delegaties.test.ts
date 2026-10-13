import { describe, expect, it } from 'vitest';
import {
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
