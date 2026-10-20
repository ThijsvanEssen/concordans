import { describe, expect, it } from 'vitest';
import {
	CHANGE_RELATIONS,
	RELATIONS,
	changeRelation,
	type Collection,
	type Relation
} from '$lib/vocabulary';
import { capitalize } from '$lib/text/words';
import catalogus from '$lib/api/relations.json';
import { hoeVan, kleineLetter, publicatie } from './hoe';
import {
	CHANGE_HEAD,
	changeAround,
	changeVerb,
	relationLabel,
	soortVan,
	relationWords
} from './relation-words';
import { wetRijVanRelated } from './loaders';
import type { Row } from './rows';

/**
 * The relations the API's catalogue has (lawgraph docs/data-model.md) that the reader never
 * sees as a verbinding, each with the reason. Every other relation has its words in relation-words.ts, for
 * every pair of collections the catalogue lets it join.
 */
const ZONDER_WOORDEN: Partial<Record<Relation, string>> = {
	VERSION_OF:
		'Een versie is de bron zelf op een dag: de lezer bladert erdoor, Verbonden en het netwerk tonen haar niet als verbinding.'
};

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
					filterGroup: 'dossiers',
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

	it('says a conclusion cites onder its point, not "in onder" (#66)', () => {
		const h = hoeVan(
			row({
				relation: 'REFERS_TO',
				direction: 'inbound',
				ref: { collection: 'judgments', key: 'ecli_nl_phr_2026_901' },
				position: 'onder 3',
				edge: { reason: 'bwb_article' }
			}),
			'articles'
		);
		expect(h?.rest).toBe('onder 3');
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
		const motie = (direction: 'inbound' | 'outbound') =>
			hoeVan(
				row({
					ref: { collection: 'documents', key: 'm' },
					relation: 'REFERS_TO',
					direction,
					edge: { basis: 'subject', text: 'Kamerstuk 25424-795' }
				}),
				'documents'
			);
		// A paper names it.
		const uit = motie('outbound');
		expect([uit?.werkwoord, uit?.rest, uit?.herkomst]).toEqual([
			'Genoemd',
			'als ‘Kamerstuk 25424-795’',
			'Onderwerp van het Kamerstuk'
		]);
		const naar = motie('inbound');
		expect([naar?.werkwoord, naar?.rest]).toEqual(['Noemt', 'dit stuk als ‘Kamerstuk 25424-795’']);
	});

	it('says a letter goes into the motion, its words under it with the reference marked', () => {
		const brief = (direction: 'inbound' | 'outbound', edge: Record<string, unknown>) =>
			hoeVan(
				row({
					ref: { collection: 'documents', key: 'b' },
					relation: 'ANSWERS',
					direction,
					confidence: 0.9,
					edge
				}),
				'documents'
			);
		const onderwerp = {
			basis: 'subject',
			text: 'Uitvoering van de motie van het lid Kathmann (Kamerstuk 25424-795)',
			reference: 'Kamerstuk 25424-795'
		};
		// On the motion: the letter gaat in op it.
		const naar = brief('inbound', onderwerp);
		expect([naar?.werkwoord, naar?.rest, naar?.herkomst]).toEqual([
			'Gaat in op',
			'dit stuk',
			'Onderwerp van het Kamerstuk'
		]);
		expect(naar?.citaat).toEqual({
			before: 'Uitvoering van de motie van het lid Kathmann (',
			mark: 'Kamerstuk 25424-795',
			after: ')'
		});
		// On the letter: it goes into the motion; a line of its text or a footnote says where.
		const uit = brief('outbound', {
			basis: 'footnote',
			text: 'de motie-Kathmann (36764, nr. 31)',
			reference: '36764, nr. 31'
		});
		expect([uit?.werkwoord, uit?.rest, uit?.herkomst]).toEqual([
			'Deze brief gaat erop in',
			null,
			'Voetnoot in de brief'
		]);
		expect(uit?.citaat?.mark).toBe('36764, nr. 31');
		expect(brief('inbound', { basis: 'text', text: 'Zie de motie.' })?.herkomst).toBe(
			'Tekst van de brief'
		);
	});

	it('names the newest pair of papers the Kamer relates two dossiers by', () => {
		const zijde = (kind: string, dossier: string, sequence: number) => ({
			case: 'c',
			paper: 'p',
			kind,
			dossier_number: dossier,
			dossier_suffix: null,
			sequence,
			date: '2026-05-01'
		});
		const h = hoeVan(
			row({
				ref: { collection: 'dossiers', key: '32761', number: '32761' },
				relation: 'RELATED_TO',
				direction: 'inbound',
				edge: {
					cases: 3,
					pairs: [
						{ case: 'c', paper: null },
						{
							kinds: 'Brief regering → Motie',
							from: zijde('Brief regering', '32761', 12),
							to: zijde('Motie', '36764', 28)
						}
					]
				}
			}),
			'dossiers'
		);
		expect(h?.rest).toBe(': Brief 32761 nr. 12 gaat in op motie 36764 nr. 28; 3 zaken');
	});

	it('gives a memorie its section about the article as its line, the opening under it', () => {
		const h = hoeVan(
			row({
				ref: { collection: 'documents', key: 'mvt' },
				title: 'Memorie van toelichting, Kamerstuk 36764',
				relation: 'EXPLAINS',
				direction: 'inbound',
				at: 's-292',
				position: '§ Artikel 21 (zorgplicht)',
				props: { sequence: 3 },
				edge: {
					heading: 'Artikel 21 (zorgplicht)',
					excerpt: 'Artikel 21 Cbw ziet op de zorgplicht.'
				}
			}),
			'articles'
		);
		expect([h?.werkwoord, h?.rest]).toEqual([null, 'nr. 3, § Artikel 21 (zorgplicht)']);
		expect(h?.plaats).toEqual({ text: '§ Artikel 21 (zorgplicht)', at: 's-292', noot: null });
		expect(h?.citaat?.after).toBe('Artikel 21 Cbw ziet op de zorgplicht.');
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
// (lawgraph tests/data/relations.json, generated from core/relations.py).
const CATALOGUS = catalogus.relations as {
	name: Relation;
	sources: Collection[];
	targets: Collection[];
}[];

describe('one source of words per relation, direction and collection', () => {
	it('knows every relation of the API', () => {
		expect(CATALOGUS.map((r) => r.name).sort()).toEqual([...RELATIONS].sort());
	});

	const paren: [Relation, Collection, Collection][] = [];
	for (const { name: relation, sources, targets } of CATALOGUS) {
		if (ZONDER_WOORDEN[relation]) continue;
		for (const a of sources) for (const b of targets) paren.push([relation, a, b]);
	}

	it.each(paren)('%s from %s to %s has its words both ways and its kind', (relation, van, naar) => {
		const w = relationWords(relation, van, naar);
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
		// A motie is submitted in its debate (API 0.79.55).
		expect(relationLabel('MADE_IN', 'documents', 'activities', { reason: 'ingediend' })).toBe(
			'ingediend in'
		);
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
			filterGroup: 'artikelen',
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

	it('says how many articles of two laws refer which way, never "Aangehaald" or the BWB id', () => {
		const wet = (inbound_count: number, outbound_count: number, dit?: string) => {
			const r = wetRijVanRelated(
				{
					date_in_force: null,
					basis: null,
					id: 'instruments/bwbr0052875',
					key: 'bwbr0052875',
					bwb_id: 'BWBR0052875',
					celex: null,
					display_name: 'Cyberbeveiligingsbesluit',
					citation_title: 'Cyberbeveiligingsbesluit',
					kind: 'amvb',
					direction:
						inbound_count && outbound_count ? 'both' : inbound_count ? 'inbound' : 'outbound',
					inbound_count,
					inbound_cited_count: inbound_count,
					outbound_count,
					outbound_cited_count: outbound_count,
					based_on: false
				},
				'BWBR0052872',
				dit
			);
			const h = hoeVan(r, 'instruments');
			return { r, regel: [h?.werkwoord, h?.rest].filter(Boolean).join(' ') };
		};
		expect(wet(17, 0).regel).toBe('17 artikelen verwijzen naar deze wet');
		expect(wet(17, 0).r).toMatchObject({ direction: 'inbound', context: 'AMvB' });
		expect(wet(17, 0).r.identifier ?? '').not.toMatch(/BWBR/);
		expect(wet(1, 0).regel).toBe('1 artikel verwijst naar deze wet');
		expect(wet(0, 4).regel).toBe('4 artikelen van deze wet verwijzen ernaar');
		expect(wet(0, 4).r.direction).toBe('outbound');
		expect(wet(0, 1, 'dit besluit').regel).toBe('1 artikel van dit besluit verwijst ernaar');
		expect(wet(12, 73).regel).toBe(
			'12 artikelen verwijzen naar deze wet, 73 artikelen van deze wet ernaar'
		);
	});

	it('says the grondslag between two laws by its direction, one function for all', () => {
		const instrument = (key: string, title: string) => ({
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
			signed_on: null,
			official_url: null,
			judgment_count: null,
			outbound_citation_count: null,
			path: null
		});
		const art = (n: string, leden: string[] = []) => ({
			basis_kind: null,
			id: `articles/x_${n}`,
			key: `x_${n}`,
			article_number: n,
			display_name: `Artikel ${n}`,
			text: n,
			leden,
			onderdelen: [],
			aanhef: false
		});
		const wet = (
			kind: string,
			basis: NonNullable<Parameters<typeof wetRijVanRelated>[0]['basis']>
		) => {
			const r = wetRijVanRelated(
				{
					date_in_force: null,
					id: 'instruments/bwbr0052900',
					key: 'bwbr0052900',
					bwb_id: 'BWBR0052900',
					celex: null,
					display_name: 'Regeling',
					citation_title: 'Regeling',
					kind,
					direction: 'inbound',
					inbound_count: 21,
					inbound_cited_count: 3,
					outbound_count: 0,
					outbound_cited_count: 0,
					based_on: true,
					basis
				},
				'BWBR0052872'
			);
			const h = hoeVan(r, 'instruments');
			return [h?.werkwoord, h?.rest];
		};
		expect(
			wet('amvb', { direction: 'inbound', via: null, articles: [art('3'), art('16', ['1', '7'])] })
		).toEqual(['AMvB op grond van', 'art. 3, 16 lid 1 en 7']);
		expect(wet('wet', { direction: 'outbound', via: null, articles: [art('7')] })).toEqual([
			'Op grond van',
			'art. 7'
		]);
		expect(
			wet('ministeriele-regeling', {
				direction: 'via',
				via: instrument('bwbr0052875', 'Cyberbeveiligingsbesluit'),
				articles: [art('19'), art('23'), art('28')]
			})
		).toEqual(['Ministeriële regeling op grond van', 'art. 19, 23, 28 Cyberbeveiligingsbesluit']);
	});

	it('names the publication that enacted a law and the articles it set', () => {
		expect(relationLabel('ESTABLISHES', 'instruments', 'articles')).toBe('stelt vast');
		expect(relationWords('ESTABLISHES', 'instruments', 'articles').terug).toBe('vastgesteld bij');
		expect(soortVan('ESTABLISHES', 'instruments', 'articles')).toBe('vaststelling van een artikel');
		expect(relationLabel('AMENDS', 'instruments', 'articles', { effect: 'nieuwe-regeling' })).toBe(
			'stelt vast'
		);
		const publicatie = hoeVan(
			row({
				ref: { collection: 'instruments', key: 'stb_2026_189' },
				relation: 'ESTABLISHES',
				direction: 'inbound',
				edge: { establishes: 111 }
			}),
			'instruments'
		);
		expect([publicatie?.werkwoord, publicatie?.rest]).toEqual(['Stelt vast', null]);
		const artikel = hoeVan(
			row({
				ref: { collection: 'instruments', key: 'stb_2026_189' },
				relation: 'ESTABLISHES',
				direction: 'inbound',
				edge: { effect: 'nieuwe-regeling', effective_date: '2026-08-15' }
			}),
			'articles'
		);
		expect([artikel?.werkwoord, artikel?.rest]).toEqual([
			'Stelt vast',
			', in werking 15 augustus 2026'
		]);
	});

	it('says a preamble that only names an article names it, not that the regulation rests on it', () => {
		expect(relationLabel('BASED_ON', 'instruments', 'articles', { basis_kind: 'mentioned' })).toBe(
			'noemt in de aanhef'
		);
		expect(
			relationWords('BASED_ON', 'instruments', 'articles', { basis_kind: 'mentioned' }).terug
		).toBe('genoemd in de aanhef van');
		const h = hoeVan(
			row({
				ref: { collection: 'instruments', key: 'bwbr0009999' },
				relation: 'BASED_ON',
				direction: 'inbound',
				props: { kind: 'beleidsregel' },
				edge: { leden: [], basis_kind: 'mentioned', referring: [] }
			}),
			'articles'
		);
		expect([h?.werkwoord, h?.rest]).toEqual(['Beleidsregel noemt in de aanhef', 'dit artikel']);
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
				filterGroup: 'fracties' as Row['filterGroup'],
				relation: 'VOTED',
				direction: 'inbound',
				edge: { choice: 'Tegen', seats: 7 }
			}),
			'decisions'
		);
		expect([h?.werkwoord, h?.rest]).toEqual(['Tegen', ', 7 zetels']);
	});
});

describe('the words of a change', () => {
	it('names the four relations of a change in the order of a line, with the head of an article’s line', () => {
		expect(CHANGE_RELATIONS).toEqual(['ESTABLISHES', 'AMENDS', 'INTRODUCES', 'REPEALS']);
		expect(CHANGE_RELATIONS.map((r) => CHANGE_HEAD[r])).toEqual([
			null,
			'Wijziging',
			'Nieuw artikel',
			'Vervalt'
		]);
		expect(changeRelation('repeals')).toBe('REPEALS');
	});

	it('gives the verb of a verbinding, by the effect where the edge has one', () => {
		expect(CHANGE_RELATIONS.map((r) => changeVerb(r))).toEqual(
			CHANGE_RELATIONS.map((r) => capitalize(relationWords(r, 'instruments', 'articles').actief))
		);
		expect(changeVerb('AMENDS', 'articles', { effect: 'vervallen' })).toBe('Doet vervallen');
		expect(changeVerb('AMENDS', 'articles', { effect: 'vernummering' })).toBe('Vernummert');
		expect(changeVerb('REPEALS', 'instruments')).toBe('Trekt in');
	});

	it('puts a separable verb around what it changes', () => {
		expect(changeAround('ESTABLISHES', 'articles', '111 artikelen')).toBe(
			'stelt 111 artikelen vast'
		);
		expect(changeAround('AMENDS', 'articles', '1 artikel')).toBe('wijzigt 1 artikel');
		expect(changeAround('REPEALS', 'instruments', 'de wet')).toBe('trekt de wet in');
	});
});
