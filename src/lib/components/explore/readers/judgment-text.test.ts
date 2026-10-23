import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import {
	bodyItems,
	judgmentParticipants,
	partiesByRole,
	partyNote,
	signatureStart,
	type BodyItem
} from './judgment-text';
import partiesFixture from '$lib/test/judgment-parties.json';
import rbzwb from '$lib/fixtures/judgment-rbzwb-2019-1062-tables.json';
import { rowsOf, type Table } from '$lib/text/tables';

type Judgment = Schema<'JudgmentDTO'>;
type Paragraph = Schema<'JudgmentParagraph'>;
type Party = Schema<'JudgmentParty'>;
type Span = Schema<'ArticleCitationSpan'>;

/** A judgment as the API sends it: nothing read but what a test gives. */
const judgment = (over: Partial<Judgment> = {}): Judgment => ({
	id: 'judgments/ECLI:NL:XX:2026:1',
	key: 'ECLI:NL:XX:2026:1',
	collection: 'judgments',
	type: 'judgment',
	display_name: null,
	labels: [],
	props: null,
	outcome: null,
	outcome_text: null,
	conclusion_outcome: null,
	conclusion_outcome_text: null,
	echr_findings: [],
	outcome_paragraph_id: null,
	conclusion_outcome_paragraph_id: null,
	source: null,
	official_url: null,
	summary_en: null,
	translation_of: null,
	names: [],
	decision_kind: null,
	series_id: null,
	series_size: null,
	same_as: null,
	replaced_by: null,
	withdrawn: null,
	withdrawn_on: null,
	published_on: null,
	advocate_general: null,
	advocate_general_role: null,
	unresolved_appeal_targets: [],
	unresolved_citations: [],
	paragraphs: [],
	footnotes: [],
	parties: null,
	translation_of_id: null,
	replaced_by_id: null,
	ecli: 'ECLI:NL:XX:2026:1',
	summary: null,
	path: null,
	...over
});

let paragraphs = 0;
/** A paragraph of a judgment, with an id of its own unless a test gives one. */
const para = (kind: string, text: string, over: Partial<Paragraph> = {}): Paragraph => ({
	paragraph_id: `p-${++paragraphs}`,
	kind,
	text,
	number: null,
	continues: null,
	tables: [],
	citations: [],
	...over
});

/** A party the API read from the kop. */
const party = (name: string, role: string, over: Partial<Party> = {}): Party => ({
	name,
	role,
	role_stated: true,
	side: 'first',
	roles: [],
	alias: null,
	representatives: [],
	...over
});

const SUBJECTS = {
	civiel: 'Civiel recht',
	strafrecht: 'Strafrecht',
	bestuursrecht: 'Bestuursrecht'
} as const;

/** The parties of a judgment the API has not read them for, from the kop in its first subheading. */
const fromKop = (kop: string, area?: keyof typeof SUBJECTS, props: Judgment['props'] = {}) =>
	judgmentParticipants(
		judgment({
			props: area ? { ...props, subjects: [SUBJECTS[area]] } : props,
			paragraphs: [para('subheading', kop)]
		})
	);

/** The kinds of what the reader lays out, prose with whether it continues an overweging. */
const kinds = (items: ReturnType<typeof bodyItems>) =>
	items.map((i) => (i.kind === 'prose' ? `prose:${i.within}` : i.kind));

const target = {
	id: 'articles/x_1',
	key: 'x_1',
	collection: 'articles' as const,
	bwb_id: 'X',
	official_id: null,
	article_number: '1',
	display_name: null
};

describe('a citation in the text', () => {
	it('a citation keeps pointing at its words after the paragraph is restructured', () => {
		const text =
			'2.1. \n       Eerste overweging.\n       \n         2.1.1. \n       Zie artikel 8:73 Awb en verder.';
		const start = text.indexOf('artikel 8:73 Awb');
		const citation: Span = {
			start,
			end: start + 'artikel 8:73 Awb'.length,
			text: 'artikel 8:73 Awb',
			kind: 'REFERS_TO',
			aanhef: false,
			target,
			leden: [],
			onderdelen: [],
			reference_kind: null,
			confidence: null,
			definition_ref: null
		};

		const items = bodyItems([para('body', text, { citations: [citation] })]);

		const cited = items.flatMap((i) =>
			i.kind === 'rov' ? (i.citations ?? []).map((c) => [i, c] as const) : []
		);
		expect(cited).toHaveLength(1);
		const [item, span] = cited[0];
		expect(item.num).toBe('2.1.1');
		expect(item.body.slice(span.start!, span.end!)).toBe('artikel 8:73 Awb');
	});
});

// ── Rechtsgebied and parties ──────────────────────────────────────────────

// Heading of ECLI:NL:HR:2019:1278, shortened.
const civielHeading = `HOGE RAAD DER NEDERLANDEN

CIVIELE KAMER

PREJUDICIËLE BESLISSING

In de zaak van

1. [eiseres 1] , wonende te [woonplaats] ,

2. [eiser 2] , wonende te [woonplaats] ,

EISERS in eerste aanleg,

hierna gezamenlijk: [eisers] ,

advocaat in de prejudiciële procedure: mr. H.J.W. Alt,

tegen

1. MAATSCHAP GRONINGEN, gevestigd te Utrecht,

2. NEDERLANDSE AARDOLIE MAATSCHAPPIJ B.V., gevestigd te Den Haag,

VERWEERSTERS in eerste aanleg,

hierna respectievelijk: de Maatschap en NAM,

3. EBN B.V.,

gevestigd te Utrecht,

VERWEERSTER in eerste aanleg,

hierna: EBN,`;

const strafHeading = `HOGE RAAD DER NEDERLANDEN

STRAFKAMER

ARREST

op het beroep in cassatie tegen een arrest van het gerechtshof Den Haag van 8\u00a0november\u00a02024, nummer 22-002967-23, in de strafzaak

tegen

[verdachte] ,

geboren in [geboorteplaats] op [geboortedatum] 1980,

hierna: de verdachte.`;

/** A kop with one party on each side and no role stated: the rechtsgebied decides the roles. */
const tegen = `in de zaak van

[A]

tegen

[B]`;

/** The roles a kop without stated roles gets under these props. */
const rolesUnder = (props: Judgment['props'], kop = tegen) =>
	fromKop(kop, undefined, props).map((p) => p.role);

describe('the rechtsgebied and the parties of the heading', () => {
	it('the rechtsgebied comes from the subjects prop first', () => {
		expect(rolesUnder({ subjects: ['Civiel recht'] }, `STRAFKAMER\n\n${tegen}`)).toEqual([
			'Eiser',
			'Verweerder'
		]);
		expect(rolesUnder({ subjects: ['Strafrecht'] })).toEqual(['Verdachte']);
		expect(rolesUnder({ subjects: ['Bestuursrecht'] })).toEqual(['Appellant', 'Verweerder']);
		expect(rolesUnder({ subjects: ['Civiel recht; Ondernemingsrecht'] })).toEqual([
			'Eiser',
			'Verweerder'
		]);
		expect(rolesUnder({ subjects: 'Belastingrecht' })).toEqual(['Appellant', 'Verweerder']);
	});

	it('without subjects, the rechtsgebied follows the kamer, court or case number', () => {
		expect(rolesUnder({}, `CIVIELE KAMER\n\n${tegen}`)).toEqual(['Eiser', 'Verweerder']);
		expect(rolesUnder({}, `STRAFKAMER\n\n${tegen}`)).toEqual(['Verdachte']);
		expect(rolesUnder({}, `HOGE RAAD DER NEDERLANDEN\n\nBELASTINGKAMER\n\n${tegen}`)).toEqual([
			'Appellant',
			'Verweerder'
		]);
		expect(rolesUnder({ court: 'Raad van State' })).toEqual(['Appellant', 'Verweerder']);
		expect(rolesUnder({ court: 'Centrale Raad van Beroep' })).toEqual(['Appellant', 'Verweerder']);
		expect(rolesUnder({ case_number: '21-004300-25' })).toEqual(['Verdachte']);
		expect(rolesUnder({ case_number: 'C/15/329906 / HA ZA 22-419' })).toEqual([
			'Eiser',
			'Verweerder'
		]);
		expect(rolesUnder({ case_number: '200.344.286/01' })).toEqual(['Eiser', 'Verweerder']);
		expect(rolesUnder({ case_number: 'AMS 21/1234' })).toEqual(['Appellant', 'Verweerder']);
		expect(rolesUnder({ court: 'Hoge Raad', case_number: '18/04298' })).toEqual([
			'Partij',
			'Partij'
		]);
		expect(rolesUnder(null)).toEqual(['Partij', 'Partij']);
	});

	it('a civil judgment names eisers and verweerders, not a verdachte', () => {
		expect(fromKop(civielHeading, 'civiel')).toEqual([
			{ role: 'Eiser', name: '[eiseres 1]' },
			{ role: 'Eiser', name: '[eiser 2]' },
			{ role: 'Verweerder', name: 'MAATSCHAP GRONINGEN' },
			{ role: 'Verweerder', name: 'NEDERLANDSE AARDOLIE MAATSCHAPPIJ B.V.' },
			{ role: 'Verweerder', name: 'EBN B.V.' }
		]);
	});

	it('a criminal judgment names the verdachte', () => {
		expect(fromKop(strafHeading, 'strafrecht')).toEqual([
			{ role: 'Verdachte', name: '[verdachte]' }
		]);
	});

	it('a role the judgment states itself takes precedence', () => {
		const ontneming = `STRAFKAMER

op een vordering tot ontneming van wederrechtelijk verkregen voordeel ten laste

van

[betrokkene] ,

hierna: de betrokkene.`;
		expect(fromKop(ontneming, 'strafrecht')).toEqual([
			{ role: 'Betrokkene', name: '[betrokkene]' }
		]);

		const hogerBeroep = `in de zaak van

[appellant] , wonend te [plaats] ,

appellant,

advocaat: mr. T.J. Vlot te Amsterdam,

tegen

KLM N.V., gevestigd te Amstelveen,

geïntimeerde,

advocaat: mr. J.M. van Slooten te Amsterdam,`;
		expect(fromKop(hogerBeroep, 'civiel')).toEqual([
			{ role: 'Appellant', name: '[appellant]' },
			{ role: 'Geïntimeerde', name: 'KLM N.V.' }
		]);
	});

	it('roles follow the rechtsgebied when the judgment states none', () => {
		const roles = (kop: string, area?: keyof typeof SUBJECTS) =>
			fromKop(kop, area).map((p) => p.role);
		expect(roles(tegen, 'civiel')).toEqual(['Eiser', 'Verweerder']);
		expect(roles(tegen, 'bestuursrecht')).toEqual(['Appellant', 'Verweerder']);
		expect(roles(`beschikking\n\n${tegen}`, 'civiel')).toEqual(['Verzoeker', 'Verweerder']);
		expect(roles(tegen)).toEqual(['Partij', 'Partij']);
	});

	it('a place of residence is not taken for a name', () => {
		const heading = `in de zaak van

wonend te [plaats] ,

appellant,

tegen

gevestigd te Amstelveen,

geïntimeerde,`;
		expect(fromKop(heading, 'civiel')).toEqual([]);
	});

	it('a heading without "tegen" yields no parties', () => {
		expect(fromKop('Afdeling strafrecht\n\nParketnummer: 21-004300-25', 'strafrecht')).toEqual([]);
	});

	// Headings below are shortened from real judgments; the ECLI names the source.

	it('the head of the full text ends at the first section heading', () => {
		const text = `RECHTBANK AMSTERDAM
      Bestuursrecht
   uitspraak van de enkelvoudige kamer in de zaak tussen
   [eiser] , uit [plaats] , eiser
   en
   het college van burgemeester en wethouders van Amsterdam, verweerder
   Samenvatting
   Deze uitspraak gaat over het wegslepen van een auto.
   tegen
   [derde]`;
		const head = [
			{ role: 'Eiser', name: '[eiser]' },
			{ role: 'Verweerder', name: 'het college van burgemeester en wethouders van Amsterdam' }
		];
		expect(judgmentParticipants(judgment({ props: { text }, paragraphs: [] }))).toEqual(head);
	});

	it('"tussen … en" with the role after each name (ECLI:NL:RBAMS:2025:3600)', () => {
		const heading = `uitspraak van de meervoudige kamer van 3\u00a0juni\u00a02025 in de zaak tussen
Moonflower B.V., uit Nunspeet, eiseres
(gemachtigde: mr. P.J. de Booij),
en
de minister van Infrastructuur en Waterstaat, verweerder
(gemachtigden: mr. S. Deaney en mr. T.W. Franssen).`;
		expect(fromKop(heading, 'bestuursrecht')).toEqual([
			{ role: 'Eiser', name: 'Moonflower B.V.' },
			{ role: 'Verweerder', name: 'de minister van Infrastructuur en Waterstaat' }
		]);
	});

	it('a hoger beroep at the Raad van State names the appellant once (ECLI:NL:RVS:2026:5642)', () => {
		const heading = `Uitspraak op de hoger beroepen van:
1. de minister van Sociale Zaken en Werkgelegenheid
2. [appellant], gevestigd in [woonplaats]
appellanten,
tegen de uitspraak van de rechtbank Gelderland van 9\u00a0juli\u00a02025 in zaak nr. 24/6811 in het geding tussen:
[appellant]
en
de minister.`;
		expect(fromKop(heading, 'bestuursrecht')).toEqual([
			{ role: 'Appellant', name: 'de minister van Sociale Zaken en Werkgelegenheid' },
			{ role: 'Appellant', name: '[appellant]' }
		]);
	});

	it('"Partijen:" lists one party per line (ECLI:NL:CRVB:2025:1295)', () => {
		const heading = `Uitspraak op de hoger beroepen tegen de uitspraak van de rechtbank Limburg van
Partijen:
[Appellante] te [woonplaats] (appellante)
de Raad van bestuur van het Uitvoeringsinstituut werknemersverzekeringen (Uwv)`;
		expect(fromKop(heading, 'bestuursrecht')).toEqual([
			{ role: 'Appellant', name: '[Appellante]' },
			{
				role: 'Verweerder',
				name: 'de Raad van bestuur van het Uitvoeringsinstituut werknemersverzekeringen'
			}
		]);
	});

	it('a strafvonnis names the verdachte after "in de zaak tegen:" (ECLI:NL:RBAMS:2025:4828)', () => {
		const heading = `Vonnis van de rechtbank Amsterdam, meervoudige kamer voor de behandeling van strafzaken, in de zaak tegen:
[verdachte] ,
geboren te [geboorteplaats] op [geboortedatum] 1977,
ingeschreven in de Basisregistratie Personen op het adres
[adres] ,
hierna: verdachte.`;
		expect(fromKop(heading, 'strafrecht')).toEqual([{ role: 'Verdachte', name: '[verdachte]' }]);
	});

	it('one side only: a beklag by two klagers (ECLI:NL:RBAMS:2025:1014)', () => {
		const heading = `beslissing van de meervoudige raadkamer op het beklag van:
[klager 1] ,
geboren op [geboortedag] 1989,
en
[klager 2] ,
geboren op [geboortedag] 1990,`;
		expect(fromKop(heading, 'strafrecht')).toEqual([
			{ role: 'Klager', name: '[klager 1]' },
			{ role: 'Klager', name: '[klager 2]' }
		]);
	});

	it('a legal form takes the name on the next line (ECLI:NL:RBAMS:2025:8258)', () => {
		const heading = `in de zaak van
1 C MANAGEMENT B.V.,
2. C TELEPORT B.V. ,
beide gevestigd te Rotterdam,
eisende partijen bij dagvaarding van 20\u00a0oktober\u00a02025,
advocaten: mr. M.A. Wielinga Carvajal en mr. G.A. Smit,
t e g e n
de rechtspersoon naar buitenlands recht
LETA CAPITAL FUND III LP ,
te Grand Cayman (Kaaimaneilanden),
gedaagde partij,`;
		expect(fromKop(heading, 'civiel')).toEqual([
			{ role: 'Eiser', name: 'C MANAGEMENT B.V.' },
			{ role: 'Eiser', name: 'C TELEPORT B.V.' },
			{ role: 'Gedaagde', name: 'LETA CAPITAL FUND III LP' }
		]);
	});

	it('an anonymised legal form takes its aanduiding (ECLI:NL:GHAMS:2026:2707)', () => {
		const heading = `inzake
1. de besloten vennootschap met beperkte aansprakelijkheid
gevestigd te Heerlen,
2. de besloten vennootschap met beperkte aansprakelijkheid
gevestigd te Utrecht,
VERZOEKSTERS,
t e g e n
de besloten vennootschap met beperkte aansprakelijkheid
gevestigd te Enschede,
VERWEERSTER,
en tegen
de besloten vennootschap met beperkte aansprakelijkheid
[de Vennootschap]
gevestigd te Utrecht,
BELANGHEBBENDE ,
Hierna zullen partijen en andere (rechts)personen als volgt worden aangeduid:
verzoekster 1 als:
[Aandeelhouder 1]
verzoekster 2 als:
[Aandeelhouder 2], tezamen met [Aandeelhouder 1] ook als verzoeksters
verweerster als:
[Aandeelhouder 3]
belanghebbende als:
[de Vennootschap] of de vennootschap`;
		expect(fromKop(heading, 'civiel')).toEqual([
			{ role: 'Verzoeker', name: '[Aandeelhouder 1]' },
			{ role: 'Verzoeker', name: '[Aandeelhouder 2]' },
			{ role: 'Verweerder', name: '[Aandeelhouder 3]' },
			{ role: 'Belanghebbende', name: '[de Vennootschap]' }
		]);
	});

	it('a heading after the last party is not a party (ECLI:NL:HR:2019:1278)', () => {
		const heading = `${civielHeading}

4. DE STAAT DER NEDERLANDEN,

VERWEERDER in eerste aanleg,

1 De prejudiciële procedure`;
		expect(fromKop(heading, 'civiel').at(-1)).toEqual({
			role: 'Verweerder',
			name: 'DE STAAT DER NEDERLANDEN'
		});
	});

	it('placeholders for an address or a V-nummer are not parties', () => {
		const heading = `in de zaak tegen:
[verdachte] ,
geboren op [geboortedag] 2001 in [geboorteplaats] ,
inschrijvingsadres in de Basisregistratie Personen:
[BRP-adres] .`;
		expect(fromKop(heading, 'strafrecht')).toEqual([{ role: 'Verdachte', name: '[verdachte]' }]);
	});

	it('the full text is read when the subheading misses the party block', () => {
		const j = judgment({
			props: {
				subjects: ['Strafrecht'],
				text: `Afdeling strafrecht
Parketnummer: 21-004300-25
Arrest van de meervoudige kamer voor strafzaken in de strafzaak tegen
[verdachte] ,
geboren op [geboortedatum] 1987 in [geboorteplaats] ,
Hoger beroep
Namens de verdachte is hoger beroep ingesteld.`
			},
			paragraphs: [
				para(
					'subheading',
					'Afdeling strafrecht\n\nParketnummer: 21-004300-25\n\ngeboren op [geboortedatum] 1987'
				)
			]
		});
		expect(judgmentParticipants(j)).toEqual([{ role: 'Verdachte', name: '[verdachte]' }]);
		expect(judgmentParticipants({ ...j, props: { subjects: ['Strafrecht'] } })).toEqual([]);
	});
});

// ── The participants named in the body ────────────────────────────────────

describe('the participants named in the body', () => {
	it('lawyers are not scanned from the body: the API reads them per party (BB0782)', () => {
		// The scan called an administrative lawyer a raadsman and named one twice.
		const j = judgment({
			parties: [],
			paragraphs: [
				para(
					'body',
					'Namens KLM hebben mr. Van Slooten voornoemd en mr. J. Boer, beiden advocaat te Amsterdam, het woord gevoerd.'
				),
				para(
					'body',
					'De Afdeling heeft de zaak ter zitting behandeld, waar appellanten, vertegenwoordigd door mr. drs. R. van Gelder, advocaat te Voorschoten, zijn verschenen.'
				)
			]
		});
		expect(judgmentParticipants(j)).toEqual([]);
	});

	it('the advocaat-generaal and a named officier van justitie come after the parties', () => {
		const j = judgment({
			parties: [party('[verdachte]', 'Verdachte')],
			paragraphs: [
				para(
					'body',
					'De advocaat-generaal mr. F.W. Bleichrodt heeft geconcludeerd tot verwerping.'
				),
				para('body', 'Gehoord de officier van justitie mr. J. de Vries, en de verdachte.'),
				para('body', 'De advocaat-generaal merkte op dat het beroep faalt.')
			]
		});
		expect(judgmentParticipants(j)).toEqual([
			{ role: 'Verdachte', name: '[verdachte]', stated: true },
			{ role: 'A-G', name: 'mr. F.W. Bleichrodt' },
			{ role: 'OvJ', name: 'mr. J. de Vries' }
		]);
	});

	it('an advocaat-generaal the kop names already is not repeated from the body', () => {
		const j = judgment({
			parties: [
				party('DE STAAT DER NEDERLANDEN', 'Verweerder', {
					representatives: [
						{ place: null, capacity: null, name: 'Mr. K. Teuben', role: 'advocaat' }
					]
				})
			],
			paragraphs: [
				para(
					'body',
					'Namens de Staat heeft mr. K. Teuben, advocaat te Den Haag, het woord gevoerd.'
				),
				para('body', 'De advocaat-generaal mr. K. Teuben heeft geconcludeerd.')
			]
		});
		expect(judgmentParticipants(j)).toEqual([
			{ role: 'Verweerder', name: 'DE STAAT DER NEDERLANDEN', stated: true },
			{ role: 'Advocaat', name: 'Mr. K. Teuben', parties: ['DE STAAT DER NEDERLANDEN'] }
		]);
	});
});

// ── Parties from the API (`JudgmentDTO.parties`, API 0.11) ──────────────────

describe('parties from the API', () => {
	it('the parties the API read come first, each followed by its lawyers', () => {
		const j = judgment({
			props: { subjects: ['Civiel recht'], text: 'in de zaak van\n[X]\ntegen\n[Y]' },
			paragraphs: [
				para(
					'body',
					'Namens eisers heeft mr. H.J.W. Alt, advocaat te Amsterdam, het woord gevoerd.'
				)
			],
			parties: [
				party('[eiseres 1]', 'Eiser', {
					alias: '[eisers]',
					representatives: [
						{ place: null, capacity: null, name: 'mr. H.J.W. Alt', role: 'advocaat' }
					]
				}),
				party('MAATSCHAP GRONINGEN', 'Verweerder', {
					role_stated: false,
					side: 'second',
					alias: 'de Maatschap',
					representatives: []
				})
			]
		});
		expect(judgmentParticipants(j)).toEqual([
			{ role: 'Eiser', name: '[eiseres 1]', stated: true },
			{ role: 'Advocaat', name: 'mr. H.J.W. Alt', parties: ['[eiseres 1]'] },
			{ role: 'Verweerder', name: 'MAATSCHAP GRONINGEN', stated: false, alias: 'de Maatschap' }
		]);
	});

	it('an empty list from the API means the kop names no parties', () => {
		const j = judgment({
			props: { subjects: ['Strafrecht'], text: 'in de strafzaak tegen\n[verdachte] ,' },
			paragraphs: [],
			parties: []
		});
		expect(judgmentParticipants(j)).toEqual([]);
	});

	it('without parties from the API, the reader reads the full text', () => {
		const j = judgment({
			props: { subjects: ['Strafrecht'], text: 'in de strafzaak tegen\n[verdachte] ,' },
			paragraphs: []
		});
		expect(judgmentParticipants(j)).toEqual([{ role: 'Verdachte', name: '[verdachte]' }]);
		expect(judgmentParticipants({ ...j, parties: null })).toEqual([
			{ role: 'Verdachte', name: '[verdachte]' }
		]);
	});

	it('a lawyer for several parties in a row is one row after them (ECLI:NL:HR:2019:1278)', () => {
		const bie = {
			name: 'Mr. J. de Bie Leuveling Tjeenk',
			role: 'advocaat' as const,
			place: null,
			capacity: null
		};
		const verweerder = (name: string, alias: string, representatives = [bie]) =>
			party(name, 'Verweerder', { side: 'second', alias, representatives });
		const parties = [
			verweerder('MAATSCHAP GRONINGEN', 'de Maatschap'),
			verweerder('NEDERLANDSE AARDOLIE MAATSCHAPPIJ B.V.', 'NAM'),
			verweerder('EBN B.V.', 'EBN', [
				{ name: 'mr. J.F. de Groot', role: 'advocaat', place: null, capacity: null }
			])
		];
		expect(
			judgmentParticipants(judgment({ paragraphs: [], parties })).map((p) => [
				p.role,
				p.name,
				p.parties
			])
		).toEqual([
			['Verweerder', 'MAATSCHAP GRONINGEN', undefined],
			['Verweerder', 'NEDERLANDSE AARDOLIE MAATSCHAPPIJ B.V.', undefined],
			['Advocaat', 'Mr. J. de Bie Leuveling Tjeenk', ['de Maatschap', 'NAM']],
			['Verweerder', 'EBN B.V.', undefined],
			['Advocaat', 'mr. J.F. de Groot', ['EBN']]
		]);
		const [{ named }] = partiesByRole(judgmentParticipants(judgment({ paragraphs: [], parties })));
		expect(named.map((p) => p.counsel)).toEqual([
			[],
			['Mr. J. de Bie Leuveling Tjeenk, advocaat, voor de Maatschap en NAM'],
			['mr. J.F. de Groot, advocaat']
		]);
	});

	it('a representative from the API with where they practise and in what capacity', () => {
		const parties = [
			party('[appellanten]', 'Appellant', {
				roles: ['Appellant'],
				alias: null,
				representatives: [
					{ capacity: null, name: 'mr. drs. R. van Gelder', role: 'advocaat', place: 'Voorschoten' }
				]
			}),
			party('het college van gedeputeerde staten van Zuid-Holland', 'Verweerder', {
				side: 'second',
				representatives: [
					{
						place: null,
						name: 'mr. A. Jansen',
						role: 'gemachtigde',
						capacity: 'ambtenaar in dienst van de provincie'
					}
				]
			}),
			party('Vereniging X', 'Partij', { role_stated: false, side: 'other' })
		];
		expect(judgmentParticipants(judgment({ paragraphs: [], parties }))).toEqual([
			{ role: 'Appellant', name: '[appellanten]', stated: true },
			{
				role: 'Advocaat',
				name: 'mr. drs. R. van Gelder',
				parties: ['[appellanten]'],
				place: 'Voorschoten'
			},
			{
				role: 'Verweerder',
				name: 'het college van gedeputeerde staten van Zuid-Holland',
				stated: true
			},
			{
				role: 'Gemachtigde',
				name: 'mr. A. Jansen',
				parties: ['het college van gedeputeerde staten van Zuid-Holland'],
				capacity: 'ambtenaar in dienst van de provincie'
			},
			{ role: 'Partij', name: 'Vereniging X', stated: true }
		]);
	});

	it('keeps the alias and the other roles of a party', () => {
		const [vnv] = judgmentParticipants(
			judgment({
				parties: [
					party('VERENIGING NEDERLANDSE VERKEERSVLIEGERS', 'Geïntimeerde', {
						roles: ['Geïntimeerde', 'Appellant'],
						alias: 'VNV'
					})
				]
			})
		);
		expect([vnv.alias, vnv.alsoAs]).toEqual(['VNV', ['Appellant']]);
	});
});

describe('partiesByRole', () => {
	it('counts pseudonymised parties and lists the named ones, by role', () => {
		const appellants = Array.from({ length: 116 }, (_, i) => ({
			role: 'Appellant',
			name: `[appellant ${i + 1}]`
		}));
		const groups = partiesByRole([
			...appellants,
			{ role: 'Advocaat', name: 'mr. M.A. de Jager', parties: ['[appellant 1]'] },
			{ role: 'Geïntimeerde', name: 'KONINKLIJKE LUCHTVAART MAATSCHAPPIJ N.V.' },
			{ role: 'Geïntimeerde', name: 'VERENIGING NEDERLANDSE VERKEERSVLIEGERS' },
			{ role: 'Eiser', name: '[eiser]', stated: false }
		]);
		expect(groups.map((g) => [g.role, g.named.length, g.anonymous.length, g.derived])).toEqual([
			['Appellant', 0, 116, false],
			['Geïntimeerde', 2, 0, false],
			['Eiser', 1, 0, true]
		]);
		expect(groups[0].counsel).toEqual(['mr. M.A. de Jager, advocaat, voor [appellant 1]']);
	});
});

describe('the parties as the reader writes them (ECLI:NL:RVS:2026:6099)', () => {
	// `judgment.parties` as /api/judgments/ECLI:NL:RVS:2026:6099 gives them.
	const parties = [
		party('Trusthave Management B.V.', 'Appellant', { roles: ['Appellant'] }),
		party('de raad van de gemeente Sluis', 'Verweerder', {
			side: 'second',
			roles: ['Verweerder'],
			representatives: [
				{ name: 'mr. J. Geelhoed', role: 'advocaat', place: 'Delft', capacity: null },
				{ name: 'D. den Hamer BSc', role: 'gemachtigde', place: null, capacity: null },
				{ name: 'L.E.G. de Rooij', role: 'gemachtigde', place: null, capacity: null }
			]
		})
	];
	const groups = partiesByRole(judgmentParticipants(judgment({ paragraphs: [], parties })));

	it('puts who acts for a party under it, in the form a judgment uses', () => {
		expect(groups.map((g) => [g.role, g.named.map((p) => [p.name, p.counsel])])).toEqual([
			['Appellant', [['Trusthave Management B.V.', []]]],
			[
				'Verweerder',
				[
					[
						'de raad van de gemeente Sluis',
						[
							'mr. J. Geelhoed, advocaat te Delft',
							'D. den Hamer BSc, gemachtigde',
							'L.E.G. de Rooij, gemachtigde'
						]
					]
				]
			]
		]);
	});

	it('names the party only where the line does not stand under it', () => {
		const lines = partiesByRole([
			{ role: 'Eiser', name: '[eiseres 1]', alias: '[eisers]' },
			{ role: 'Advocaat', name: 'mr. H.J.W. Alt', parties: ['[eisers]'] },
			{ role: 'Appellant', name: '[appellant 1]' },
			{ role: 'Appellant', name: '[appellant 2]' },
			{
				role: 'Gemachtigde',
				name: 'mr. A. Jansen',
				parties: ['[appellant 2]'],
				capacity: 'ambtenaar in dienst van de provincie'
			}
		]);
		expect(lines.map((g) => [g.role, g.named.flatMap((p) => p.counsel), g.counsel])).toEqual([
			['Eiser', ['mr. H.J.W. Alt, advocaat'], []],
			[
				'Appellant',
				[],
				['mr. A. Jansen, gemachtigde, ambtenaar in dienst van de provincie, voor [appellant 2]']
			]
		]);
	});
});

describe('whom a lawyer acts for, where the line does not stand under the party', () => {
	const under = (parties: string[]) =>
		partiesByRole([
			{ role: 'Geïntimeerde', name: 'KLM' },
			{ role: 'Advocaat', name: 'mr. X', parties }
		])[0].named[0].counsel[0];
	it('counts the pseudonymised parties a lawyer acts for', () => {
		const many = Array.from({ length: 116 }, (_, i) => `[appellant ${i + 1}]`);
		expect(under(many)).toBe('mr. X, advocaat, voor 116 geanonimiseerde partijen');
		expect(under(['KLM', '[eiser 1]', '[eiser 2]'])).toBe(
			'mr. X, advocaat, voor KLM en 2 geanonimiseerde partijen'
		);
		expect(under(['[appellant]'])).toBe('mr. X, advocaat, voor [appellant]');
	});
});

describe('the parties of judgments the API read them for', () => {
	// `judgment.parties` as /api/judgments/{ecli} gives them.
	const rows = (ecli: keyof typeof partiesFixture) =>
		partiesByRole(
			judgmentParticipants(
				judgment({ paragraphs: [], parties: partiesFixture[ecli] as unknown as Party[] })
			)
		).map((g) => [
			g.role,
			g.named.map((p) => [[p.name, partyNote(p)].filter(Boolean).join(' '), ...p.counsel]),
			g.anonymous.length,
			g.counsel
		]);

	it('leaves the parties out where the lawyer acts for the whole row (HR:2025:1319)', () => {
		expect(rows('ECLI:NL:HR:2025:1319')).toEqual([
			[
				'Eiser',
				[
					['COBRASPEN VASTGOED ONTWIKKELING B.V.'],
					['STORM DUNE FILTERED WATER B.V. (Cobraspen c.s.)']
				],
				0,
				['R.T. Wiegerink, advocaat']
			],
			[
				'Verweerder',
				[
					[
						'N.V. PWN WATERLEIDINGBEDRIJF NOORD-HOLLAND (PWN)',
						'P.A. Fruytier, advocaat',
						'J.P. Jas, advocaat'
					]
				],
				0,
				[]
			],
			['Belanghebbende', [['STICHTING VOLKSSTERRENWACHT COPERNICUS']], 0, []]
		]);
	});

	it('names a party by the alias the reader shows, not a placeholder (GHARL:2025:116)', () => {
		expect(rows('ECLI:NL:GHARL:2025:116')).toEqual([
			['Appellant', [['[appellant]', 'mr. M.B. Bollen, advocaat']], 0, []],
			['Geïntimeerde', [['[geïntimeerde]', 'mr. A.A. Dooijeweerd, advocaat']], 0, []]
		]);
	});

	it('reads a name without the "en" that joins the next party (GHAMS:2025:118)', () => {
		expect(rows('ECLI:NL:GHAMS:2025:118')).toEqual([
			['Appellant', [], 2, ['mr. M.A. van der Lubbe, advocaat']],
			[
				'Geïntimeerde',
				[],
				4,
				[
					'mr. J. van de Riet, advocaat, voor 3 geanonimiseerde partijen',
					'mr. K. Kroon, advocaat, voor [VvE]'
				]
			],
			['Belanghebbende', [], 3, []]
		]);
	});

	it('writes the role once where the kop gave it with the name (RBGEL:2025:117)', () => {
		expect(rows('ECLI:NL:RBGEL:2025:117')[1]).toEqual([
			'Verdachte',
			[['[verdachte]', 'mr. S. Kriekaard, advocaat']],
			0,
			[]
		]);
	});

	it('puts a line for the whole row after its last party, with both roles (GHAMS:2025:109)', () => {
		expect(rows('ECLI:NL:GHAMS:2025:109')[1]).toEqual([
			'Geïntimeerde',
			[['notaris'], ['[geïntimeerde]']],
			0,
			['mr. H.J. Delhaas, advocaat, gemachtigde']
		]);
	});

	it('puts a line for the whole row after the count (GHAMS:2025:121)', () => {
		expect(rows('ECLI:NL:GHAMS:2025:121')).toEqual([
			['Appellant', [['[appellant]', 'mr. R.L.G.J. Eikelboom, advocaat']], 0, []],
			[
				'Geïntimeerde',
				[['de Stichting RAAD VAN ARBITRAGE IN BOUWGESCHILLEN']],
				4,
				['mr. O.B. Zwijnenberg, advocaat']
			]
		]);
	});

	it('writes where a lawyer practises under the count (GHAMS:2025:122)', () => {
		expect(rows('ECLI:NL:GHAMS:2025:122')).toEqual([
			['Appellant', [], 2, ['mr. M. Steenhuis, advocaat te Den Bosch']],
			[
				'Geïntimeerde',
				[['SONY MUSIC ENTERTAINMENT NETHERLANDS B.V.', 'mr. R. van Dongen, advocaat te Amsterdam']],
				0,
				[]
			]
		]);
	});
});

describe('a numbered line in the text', () => {
	it('is a title when it reads as one', () => {
		const items = bodyItems([para('body', '2. De beoordeling')]);
		expect(items.map((i) => [i.kind, i.kind === 'heading' && i.text])).toEqual([
			['heading', '2. De beoordeling']
		]);
	});
	it('is a quotation, not a title, when it ends in a closing quote', () => {
		const items = bodyItems([para('body', '5.1. Both grounds for appeal fail.”')]);
		expect(items.some((i) => i.kind === 'heading')).toBe(false);
	});
});

describe('signatureStart', () => {
	const body = (text: string, number: string | null = null) => ({ kind: 'body', number, text });
	it('finds the lines a conclusion of the Parket is signed with', () => {
		const paragraphs = [
			{ kind: 'heading', number: '4', text: 'Conclusie' },
			body('De conclusie strekt tot vernietiging van het arrest van het hof.'),
			body('De Procureur-Generaal bij de'),
			body('Hoge Raad der Nederlanden'),
			body('A-G')
		];
		expect(signatureStart(paragraphs)).toBe(2);
		expect(signatureStart([...paragraphs.slice(0, 4), body('Advocaat-Generaal')])).toBe(2);
	});
	it('leaves a text that ends otherwise alone', () => {
		const paragraphs = [body('Dit arrest is gewezen door de vice-president.'), body('A-G', '5.1')];
		expect(signatureStart(paragraphs)).toBe(2);
	});
});

describe('the body as the reader lays it out', () => {
	it('keeps a paragraph under the overweging it continues (RVS:2026:5682, r.o. 1)', () => {
		const items = bodyItems([
			para('subheading', 'AFDELING\n\nBESTUURSRECHTSPRAAK'),
			para('body', 'Overgangsrecht inwerkingtreding Omgevingswet'),
			para(
				'body',
				'Op 1\u00a0januari\u00a02024 zijn de Omgevingswet en de Invoeringswet in werking getreden.',
				{ number: '1', paragraph_id: 'rov-1' }
			),
			para('body', 'De aanvraag om een omgevingsvergunning is ingediend op 22\u00a0mei\u00a02022.'),
			para('body', 'Inleiding'),
			para('body', 'Tot slot stelt appellant dat de vergunning leidt tot rechtsongelijkheid.')
		]);
		expect(kinds(items)).toEqual(['subheading', 'rov', 'prose:true', 'subheading', 'prose:false']);
		expect(items[1]).toMatchObject({ kind: 'rov', num: '1', id: 'rov-1' });
	});

	it('reads the text a conclusion left in its kop, after "hierna: de verdachte"', () => {
		const kop = [
			'PROCUREUR-GENERAAL',
			'BIJ DE',
			'HOGE RAAD DER NEDERLANDEN',
			'CONCLUSIE',
			'[verdachte] ,',
			'hierna: de verdachte',
			'De verdachte is bij arrest van 7\u00a0oktober\u00a02014 door het gerechtshof niet-ontvankelijk verklaard in het hoger beroep, ingesteld tegen het vonnis van de politierechter.',
			'Derhalve is het cassatieberoep ontvankelijk.'
		].join('\n\n');
		const items = bodyItems([para('subheading', kop)]);
		expect(items.map((i) => (i.kind === 'prose' ? i.body : i.kind))).toEqual([
			'De verdachte is bij arrest van 7\u00a0oktober\u00a02014 door het gerechtshof niet-ontvankelijk verklaard in het hoger beroep, ingesteld tegen het vonnis van de politierechter.',
			'Derhalve is het cassatieberoep ontvankelijk.'
		]);
	});

	it('takes the kinds the API will give: a table of contents is left out, continues is followed', () => {
		const items = bodyItems([
			para('toc', '1 Procesverloop'),
			para(
				'body',
				'Op 1\u00a0januari\u00a02024 zijn de Omgevingswet en de Invoeringswet in werking getreden.',
				{ number: '1', paragraph_id: 'rov-1' }
			),
			para('body', 'Tussenkop'),
			para('body', 'Een zin die de overweging voortzet.', { continues: 'rov-1' })
		]);
		expect(kinds(items)).toEqual(['rov', 'subheading', 'prose:true']);
	});

	it('leaves out the heading of a table of contents with its lines', () => {
		const items = bodyItems([
			para('heading', 'Inhoudsopgave'),
			para('toc', '1 Procesverloop'),
			para('toc', '2 Uitgangspunten en feiten (2.1-2.3.2)'),
			para('heading', 'Procesverloop', { number: '1' })
		]);
		expect(items.map((i) => (i.kind === 'heading' ? i.text : i.kind))).toEqual([
			'1. Procesverloop'
		]);
	});

	it('puts the number of a heading before its title', () => {
		const items = bodyItems([
			para('heading', 'Beoordeling van de aanvraag', { number: '3' }),
			para('heading', '4. Beslissing', { number: '4' })
		]);
		expect(items.map((i) => (i.kind === 'heading' ? [i.text, i.id] : ''))).toEqual([
			['3. Beoordeling van de aanvraag', 'h-beoordeling-van-de-aanvraag'],
			['4. Beslissing', 'h-4-beslissing']
		]);
	});

	it('leaves a kop that is only a kop', () => {
		const kop = 'HOGE RAAD\n\nSTRAFKAMER\n\nNummer 25/04731\n\nARREST\n\nhierna: de klager.';
		expect(bodyItems([para('subheading', kop)])).toEqual([]);
	});

	it('shows a later subheading as one, its white space collapsed', () => {
		const items = bodyItems([para('subheading', 'Kop'), para('subheading', '  De   feiten \n ')]);
		expect(items).toEqual([{ kind: 'subheading', text: 'De feiten' }]);
	});

	it('takes a short line without a stop for a title, a sentence or a signature not', () => {
		const kind = (line: string) => bodyItems([para('body', line)])[0].kind;
		expect(kind('Toetsingskader')).toBe('subheading');
		expect(kind('Bijlage: lijst van gebruikte afkortingen')).toBe('subheading');
		expect(kind('(zie hierna in 4.1-4.8)')).toBe('prose');
		expect(kind('w.g. Minderhoud lid van de enkelvoudige kamer')).toBe('prose');
		expect(kind('932-1191')).toBe('prose');
		expect(kind('Ten slotte is vonnis bepaald.')).toBe('prose');
	});
});

describe('the tables in a judgment (A55, API #818)', () => {
	// ECLI:NL:RBZWB:2019:1062 as the API gives it: r.o. 1.1 ends in a table of four columns,
	// r.o. 2.5 is a sentence and a table of seven whose headers span two rows.
	const paragraphs = rbzwb.paragraphs as Paragraph[];
	const items = bodyItems(paragraphs);
	const rov = (num: string) =>
		items.find((i): i is Extract<BodyItem, { kind: 'rov' }> => i.kind === 'rov' && i.num === num)!;
	const rows = (item: { body: string; tables?: Table[] }) =>
		rowsOf(item.body, item.tables![0]).map((r) =>
			r.cells.map((c) => item.body.slice(c.start, c.end))
		);

	it('keeps a table as the source lays it out: a row a line, its cells apart', () => {
		const r = rov('2.5');
		expect(r.body).toMatch(/^Het onder 1\.1 vermelde/);
		expect(r.tables).toHaveLength(1);
		const t = rows(r);
		expect(t[0]).toEqual([
			'Periode van – tot en met',
			'Tijd- vak',
			'Loonheffingen',
			'Verzuim-boete',
			'Kosten',
			'Betaling / verrekening',
			'Onbetaald'
		]);
		expect(t.at(-1)).toEqual([
			'Totaal',
			'',
			'€ 435.760',
			'€ 4.886',
			'€ 30',
			'-/- € 18.510',
			'€ 422.166'
		]);
		// The empty cells at the end of a row stay: "Jaar 2014" and six empty ones.
		expect(t[6]).toEqual(['Jaar 2014', '', '', '', '', '', '']);
		expect(r.tables![0].spans).toContainEqual({ row: 0, cell: 1, cols: 1, rows: 2 });
	});

	it('collapses the whitespace around a table, not in it', () => {
		const r = rov('1.1');
		const t = r.tables![0];
		expect(r.body.slice(0, t.start)).not.toMatch(/\t| {2}/);
		expect(rows(r).every((row) => row.length === 4)).toBe(true);
		expect(t.end).toBeLessThanOrEqual(r.body.length);
	});

	it('gives a paragraph without a table none', () => {
		expect(items.filter((i) => 'tables' in i && i.tables).length).toBe(2);
	});
});
