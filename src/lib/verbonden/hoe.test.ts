import { describe, expect, it } from 'vitest';
import { RELATIONS, type Collection, type Relation } from '$lib/vocabulary';
import {
	hoeVan,
	kleineLetter,
	publicatie,
	relationLabel,
	soortVan,
	woordenVan,
	ZONDER_WOORDEN
} from './hoe';
import { wetRijVanRelated } from './loaders';
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
	it('says what a dossier is to its wet: its bill, or a bill that amended it', () => {
		const dossier = (edge: Record<string, unknown>) =>
			hoeVan(
				row({
					ref: { collection: 'dossiers', key: '36764', number: '36764' },
					kind: 'dossiers',
					relation: 'LEGISLATED_IN',
					direction: 'outbound',
					confidence: 1,
					edge
				}),
				'instruments'
			);
		const eigen = dossier({ via: 'instrument' });
		expect([eigen?.werkwoord, eigen?.rest]).toEqual(['Wetsvoorstel', 'van deze wet']);
		const wijziging = dossier({ via: 'amending_publication', publication: 'stb_2025_124' });
		expect([wijziging?.werkwoord, wijziging?.rest]).toEqual([
			'Wijzigt',
			'deze wet, Stb. 2025, 124'
		]);
	});

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

	it('names a Kamerstuk the subject names as it is written, in either direction', () => {
		const motie = (relation: 'ANSWERS' | 'REFERS_TO', direction: 'inbound' | 'outbound') =>
			hoeVan(
				row({
					ref: { collection: 'documents', key: 'm' },
					relation,
					direction,
					edge: { basis: 'subject', text: 'Kamerstuk 25424-795' }
				}),
				'documents'
			);
		// A paper names it; a letter of the government goes into the motion it names.
		for (const [relation, uitWoord, inWoord] of [
			['REFERS_TO', 'Genoemd', 'Noemt'],
			['ANSWERS', 'Besproken', 'Gaat in op']
		] as const) {
			const uit = motie(relation, 'outbound');
			expect([uit?.werkwoord, uit?.rest, uit?.herkomst]).toEqual([
				uitWoord,
				'als ‘Kamerstuk 25424-795’',
				'Onderwerp van het Kamerstuk'
			]);
			const naar = motie(relation, 'inbound');
			expect([naar?.werkwoord, naar?.rest]).toEqual([
				inWoord,
				'dit stuk als ‘Kamerstuk 25424-795’'
			]);
		}
	});

	it('leaves a letter that fulfils a toezegging to its group', () => {
		const brief = row({
			ref: { collection: 'documents', key: 'b' },
			relation: 'ANSWERS',
			direction: 'inbound',
			edge: {}
		});
		expect(hoeVan(brief, 'commitments')).toBeNull();
	});

	it('cites a publication as it is written', () => {
		expect(publicatie('Stb.2021-162')).toBe('Stb. 2021, 162');
	});
});

// The relations of the API with the collections at their two ends, as its catalogue lists them
// (lawgraph docs/data-model.md, generated from core/relations.py).
const CATALOGUS: Record<Relation, [Collection[], Collection[]]> = {
	PART_OF: [
		['articles', 'annexes', 'documents', 'cases', 'instruments'],
		['instruments', 'cases', 'dossiers']
	],
	VERSION_OF: [
		['instrument_versions', 'article_versions'],
		['instruments', 'articles']
	],
	AMENDS: [
		['instruments', 'documents'],
		['instruments', 'articles']
	],
	INTRODUCES: [
		['instruments', 'documents'],
		['instruments', 'articles']
	],
	REPEALS: [
		['instruments', 'documents'],
		['instruments', 'articles']
	],
	BASED_ON: [['instruments'], ['articles']],
	IMPLEMENTS: [['instruments'], ['instruments']],
	LEGISLATED_IN: [['instruments'], ['dossiers']],
	PUBLISHED_IN: [['instruments'], ['instruments']],
	REFERS_TO: [
		['articles', 'documents', 'judgments', 'instruments'],
		['articles', 'instruments', 'judgments', 'documents']
	],
	EXPLAINS: [['documents'], ['article_versions', 'articles', 'instruments']],
	APPEAL_OF: [['judgments'], ['judgments']],
	CONTINUES: [
		['judgments', 'activities'],
		['judgments', 'activities']
	],
	REFERRED_BY: [['judgments'], ['judgments']],
	ADVISES_ON: [['judgments'], ['judgments']],
	ANSWERS: [
		['judgments', 'documents'],
		['judgments', 'commitments', 'documents']
	],
	SAME_AS: [
		['judgments', 'instruments', 'documents', 'members'],
		['judgments', 'instruments', 'members']
	],
	SCOPED_BY: [['articles'], ['annexes']],
	ABOUT: [
		['activities', 'decisions', 'commitments'],
		['cases', 'dossiers']
	],
	LED_BY: [['activities', 'cases'], ['committees']],
	MADE_IN: [['commitments', 'documents', 'decisions'], ['activities']],
	MEMBER_OF: [['members'], ['committees', 'factions']],
	SERVED_IN: [['members'], ['cabinets']],
	AUTHORED: [['members'], ['documents', 'cases', 'commitments']],
	RELATED_TO: [
		['dossiers', 'judgments', 'cases'],
		['dossiers', 'judgments', 'cases']
	],
	REVISES: [
		['dossiers', 'documents'],
		['dossiers', 'documents']
	],
	ACCOMPANIES: [
		['dossiers', 'documents'],
		['dossiers', 'documents']
	],
	SECOND_READING_OF: [['dossiers'], ['dossiers']],
	VOTED: [['members', 'factions'], ['decisions']]
};

describe('one source of words per relation, direction and collection', () => {
	it('knows every relation of the API', () => {
		expect(Object.keys(CATALOGUS).sort()).toEqual([...RELATIONS].sort());
	});

	const paren: [Relation, Collection, Collection][] = [];
	for (const relation of RELATIONS) {
		if (ZONDER_WOORDEN[relation]) continue;
		const [van, naar] = CATALOGUS[relation];
		for (const a of van) for (const b of naar) paren.push([relation, a, b]);
	}

	it.each(paren)('%s from %s to %s has its words both ways and its kind', (relation, van, naar) => {
		const w = woordenVan(relation, van, naar);
		for (const woord of [w.actief, w.terug, w.soort]) {
			expect(woord.trim()).not.toBe('');
			// One preposition once: never "gedaan in in een Kamerstuk".
			expect(woord).not.toMatch(/\b(\w+) \1\b/);
			expect(woord).not.toMatch(/^[A-Z]/);
		}
	});

	it('leaves a relation out only with its reason', () => {
		for (const [relation, reden] of Object.entries(ZONDER_WOORDEN)) {
			expect(RELATIONS).toContain(relation);
			expect(reden!.length).toBeGreaterThan(20);
		}
	});

	it('says the verbindingen the research found wrong in legal and parliamentary words', () => {
		// One verb per change, the same in the row, the line and the card.
		expect(relationLabel('INTRODUCES', 'instruments', 'articles')).toBe('voegt in');
		expect(relationLabel('REPEALS', 'instruments', 'articles')).toBe('doet vervallen');
		expect(relationLabel('REPEALS', 'instruments', 'instruments')).toBe('trekt in');
		expect(relationLabel('AMENDS', 'instruments', 'articles', { effect: 'vervallen' })).toBe(
			'doet vervallen'
		);
		// An amended motion replaces the one it names; a budget change revises its budget.
		expect(relationLabel('REVISES', 'documents', 'documents', { rule: 'vervanging' })).toBe(
			'vervangt'
		);
		expect(soortVan('REVISES', 'documents', 'documents')).toBe(
			'vervanging van een motie of amendement'
		);
		expect(relationLabel('REVISES', 'dossiers', 'dossiers', { rule: 'begrotingswijziging' })).toBe(
			'wijzigt de begroting'
		);
		// A bijlage with its letter; a budget change with its nota.
		expect(relationLabel('ACCOMPANIES', 'documents', 'documents')).toBe('bijlage bij');
		expect(relationLabel('ACCOMPANIES', 'dossiers', 'dossiers')).toBe('ingediend met');
		// Read from the member: she diende in, the minister ondertekende.
		expect(relationLabel('AUTHORED', 'members', 'documents', { capacity: 'kamerlid' })).toBe(
			'diende in'
		);
		expect(
			relationLabel('AUTHORED', 'members', 'documents', {
				capacity: 'bewindspersoon',
				function: 'minister van Justitie en Veiligheid'
			})
		).toBe('ondertekende als minister van Justitie en Veiligheid');
		// A stenogram is the record of its debate; no "in in".
		expect(relationLabel('MADE_IN', 'documents', 'activities')).toBe('verslag van');
		expect(soortVan('MADE_IN', 'documents', 'activities')).toBe('verslag van een debat');
		expect(relationLabel('MADE_IN', 'commitments', 'activities')).toBe('toegezegd in');
		// The nota van toelichting and its Staatsblad: one publication, not one judgment.
		expect(relationLabel('SAME_AS', 'documents', 'instruments')).toBe('zelfde publicatie als');
		expect(relationLabel('SAME_AS', 'judgments', 'judgments')).toBe('zelfde uitspraak als');
		// A Kamerstuk noemt, a judgment haalt aan, an article verwijst naar.
		expect(relationLabel('REFERS_TO', 'documents', 'articles')).toBe('noemt');
		expect(relationLabel('REFERS_TO', 'judgments', 'articles')).toBe('haalt aan');
		expect(relationLabel('REFERS_TO', 'articles', 'articles')).toBe('verwijst naar');
		expect(relationLabel('PUBLISHED_IN', 'instruments', 'instruments')).toBe('gepubliceerd in');
	});
});

describe('the line of a reference', () => {
	const artikel = (r: Partial<Row>) =>
		row({
			ref: { collection: 'articles', key: 'a' },
			kind: 'artikelen',
			relation: 'REFERS_TO',
			...r
		});

	it('names the aard of an article that refers, after its lid', () => {
		const h = hoeVan(artikel({ direction: 'inbound', lid: '2', aard: 'voorwaarde' }), 'articles');
		expect([h?.werkwoord, h?.rest]).toEqual(['Verwijst naar', 'lid 2, als voorwaarde']);
		const zonder = hoeVan(artikel({ direction: 'inbound', aard: 'voorwaarde' }), 'articles');
		expect([zonder?.werkwoord, zonder?.rest]).toEqual([
			'Verwijst naar',
			'dit artikel, als voorwaarde'
		]);
	});

	it('never says "Verwijst naar als"', () => {
		const h = hoeVan(
			artikel({
				direction: 'inbound',
				edge: { text: 'artikel 3:2 van de Algemene wet bestuursrecht' }
			}),
			'articles'
		);
		expect(`${h?.werkwoord} ${h?.rest}`).toBe(
			'Verwijst naar dit artikel als ‘artikel 3:2 van de Algemene wet bestuursrecht’'
		);
		const uit = hoeVan(
			artikel({ direction: 'outbound', edge: { text: 'artikel 16 van de wet' } }),
			'articles'
		);
		expect(`${uit?.werkwoord} ${uit?.rest}`).toBe('Verwijst ernaar als ‘artikel 16 van de wet’');
		const beide = hoeVan(
			artikel({ direction: 'inbound', lid: '1', aard: 'definitie', edge: { text: 'artikel 16' } }),
			'articles'
		);
		expect(`${beide?.werkwoord} ${beide?.rest}`).toBe(
			'Verwijst naar lid 1, als definitie: ‘artikel 16’'
		);
	});

	it('says where an article of a law refers, by its aard, without "Aangehaald"', () => {
		const h = hoeVan(
			artikel({ direction: 'outbound', aard: 'voorwaarde', edge: { doel: 'art. 6:214 BW' } }),
			'instruments'
		);
		expect([h?.werkwoord, h?.rest]).toEqual(['Verwijst naar', 'art. 6:214 BW, als voorwaarde']);
	});

	it('says which way two laws refer, never "Aangehaald" and never the BWB id', () => {
		const wet = (inbound_count: number, outbound_count: number) => {
			const r = wetRijVanRelated({
				id: 'instruments/bwbr0052875',
				key: 'bwbr0052875',
				bwb_id: 'BWBR0052875',
				celex: null,
				display_name: 'Cyberbeveiligingsbesluit',
				citation_title: 'Cyberbeveiligingsbesluit',
				inbound_count,
				outbound_count
			});
			const h = hoeVan(r, 'instruments');
			return { r, regel: [h?.werkwoord, h?.rest].join(' ') };
		};
		expect(wet(23, 0).regel).toBe('Verwijst 23 keer naar deze wet');
		expect(wet(23, 0).r).toMatchObject({ direction: 'inbound', identifier: null });
		expect(wet(0, 4).regel).toBe('Deze wet verwijst er 4 keer naar');
		expect(wet(0, 4).r.direction).toBe('outbound');
		expect(wet(12, 73).regel).toBe(
			'Verwijzen over en weer : 12 keer naar deze wet, 73 keer vanuit deze wet'
		);
	});

	it('sets a change of the row apart from its day with a comma', () => {
		const h = hoeVan(
			row({
				ref: { collection: 'articles', key: 'a' },
				relation: 'AMENDS',
				direction: 'outbound',
				edge: { effect: 'wijziging', effective_date: '2026-08-15' }
			}),
			'instruments'
		);
		expect([h?.werkwoord, h?.rest]).toEqual(['Wijzigt', ', in werking 15 augustus 2026']);
	});
});

describe('kleineLetter', () => {
	it('lowers a word, never a name', () => {
		expect(kleineLetter('Herkend in de tekst')).toBe('herkend in de tekst');
		expect(kleineLetter('Tweede Kamer, zaak gerelateerd aan zaak')).toBe(
			'Tweede Kamer, zaak gerelateerd aan zaak'
		);
		expect(kleineLetter('ECLI genoemd in de tekst')).toBe('ECLI genoemd in de tekst');
	});
});

describe('the line of a vote', () => {
	it('says how a fractie voted, with its seats', () => {
		const h = hoeVan(
			row({
				ref: { collection: 'factions', key: 'f' },
				kind: 'fracties' as Row['kind'],
				relation: 'VOTED',
				direction: 'inbound',
				edge: { choice: 'Tegen', seats: 7 }
			}),
			'decisions'
		);
		expect([h?.werkwoord, h?.rest]).toEqual(['Tegen', ', 7 zetels']);
	});
});
