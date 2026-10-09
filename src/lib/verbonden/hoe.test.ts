import { describe, expect, it } from 'vitest';
import { hoeVan, publicatie } from './hoe';
import type { Row } from './rows';

const row = (r: Partial<Row>): Row =>
	({
		ref: { collection: 'judgments', key: 'x' },
		title: 'x',
		context: null,
		kind: 'uitspraken',
		...r
	}) as Row;

describe('hoeVan', () => {
	it('says how the Kamer joined two dossiers, from the edge', () => {
		const h = hoeVan(
			row({
				ref: { collection: 'dossiers', key: '27926', number: '27926' },
				relation: 'RELATED_TO',
				direction: 'inbound',
				edge: { cases: 2, case_kinds: ['Brief regering → Motie'] }
			}),
			'dossiers'
		);
		expect([h?.werkwoord, h?.rest, h?.herkomst]).toEqual([
			'Door de Kamer verbonden',
			': 2 zaken, brief regering → motie',
			'Tweede Kamer, zaak gerelateerd aan zaak'
		]);
	});

	it('names a change by its effect, its day and its publication', () => {
		const h = hoeVan(
			row({
				ref: { collection: 'instruments', key: 'stb' },
				relation: 'AMENDS',
				direction: 'inbound',
				edge: {
					effect: 'wijziging',
					effective_date: '2024-07-01',
					source_publication: 'Stb.2024-193'
				}
			}),
			'articles'
		);
		expect([h?.werkwoord, h?.rest, h?.herkomst]).toEqual([
			'Wijzigt',
			'dit artikel, in werking 1 juli 2024',
			'Wetten.overheid.nl, Stb. 2024, 193'
		]);
	});

	it('gives a citation its lid, its places and its count, and marks it derived', () => {
		const h = hoeVan(
			row({
				relation: 'REFERS_TO',
				direction: 'inbound',
				lid: '3',
				position: 'r.o. 4.3 en 5.1',
				confidence: 0.7,
				edge: { reason: 'bwb_article', mention_count: 2 }
			}),
			'articles'
		);
		expect([h?.werkwoord, h?.rest, h?.afgeleid, h?.herkomst]).toEqual([
			'Haalt aan',
			'lid 3, in r.o. 4.3 en 5.1, 2 keer',
			true,
			'Herkend in de tekst'
		]);
	});

	it('quotes the words of a law that refers, and names its source', () => {
		const h = hoeVan(
			row({
				ref: { collection: 'articles', key: 'a' },
				relation: 'REFERS_TO',
				direction: 'inbound',
				lid: '3',
				edge: { reason: 'bwb_xml_ref', text: 'artikel 248 lid 3 van Boek 7' }
			}),
			'articles'
		);
		expect([h?.werkwoord, h?.rest, h?.herkomst]).toEqual([
			'Verwijst naar',
			'lid 3 als ‘artikel 248 lid 3 van Boek 7’',
			'Verwijzing in de wettekst, wetten.overheid.nl'
		]);
	});

	it('gives a vote its outcome and tally', () => {
		const h = hoeVan(
			row({
				ref: { collection: 'decisions', key: 'd' },
				relation: 'ABOUT',
				direction: 'inbound',
				date: '2024-04-25',
				props: { decision_text: 'Verworpen.', tally: { Voor: 27, Tegen: 123 } }
			}),
			'dossiers'
		);
		expect([h?.werkwoord, h?.rest]).toEqual(['Verworpen', ', 27 voor en 123 tegen']);
	});

	it('names the remedy of an appeal, and its formal source', () => {
		const h = hoeVan(
			row({
				relation: 'APPEAL_OF',
				direction: 'outbound',
				aard: 'cassatie',
				edge: { basis: 'formal_relation' }
			}),
			'judgments'
		);
		expect([h?.werkwoord, h?.rest, h?.herkomst]).toEqual([
			'Bestreden',
			'in cassatie met deze uitspraak',
			'Rechtspraak.nl, formele relatie'
		]);
	});

	it('says nothing where the group says all', () => {
		const stuk = row({
			ref: { collection: 'documents', key: 'd' },
			relation: 'PART_OF',
			direction: 'inbound'
		});
		expect(hoeVan(stuk, 'dossiers')).toBeNull();
	});

	it('cites a publication as it is written', () => {
		expect(publicatie('Stb.2021-162')).toBe('Stb. 2021, 162');
	});
});
