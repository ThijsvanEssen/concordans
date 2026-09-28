import { describe, expect, it, test } from 'vitest';
import {
	caseArea,
	extractParticipants,
	extractParties,
	judgmentHead,
	judgmentParticipants,
	forParties,
	partiesByRole,
	splitBodyParagraph
} from './judgment-text';

const target = {
	id: 'articles/x_1',
	key: 'x_1',
	collection: 'articles',
	bwb_id: 'X',
	article_number: '1',
	display_name: null
};

test('a citation keeps pointing at its words after the paragraph is restructured', () => {
	const text =
		'2.1. \n       Eerste overweging.\n       \n         2.1.1. \n       Zie artikel 8:73 Awb en verder.';
	const start = text.indexOf('artikel 8:73 Awb');
	const citation = {
		start,
		end: start + 'artikel 8:73 Awb'.length,
		text: 'artikel 8:73 Awb',
		kind: 'REFERS_TO',
		aanhef: false,
		target
	};

	const segments = splitBodyParagraph(text, [citation]);

	const cited = segments.flatMap((s) =>
		s.kind === 'body' ? (s.citations ?? []).map((c) => [s, c] as const) : []
	);
	expect(cited).toHaveLength(1);
	const [segment, span] = cited[0];
	expect(segment.kind === 'body' && segment.num).toBe('2.1.1');
	expect(segment.kind === 'body' && segment.body.slice(span.start!, span.end!)).toBe(
		'artikel 8:73 Awb'
	);
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

op het beroep in cassatie tegen een arrest van het gerechtshof Den Haag van 8 november 2024, nummer 22-002967-23, in de strafzaak

tegen

[verdachte] ,

geboren in [geboorteplaats] op [geboortedatum] 1980,

hierna: de verdachte.`;

test('the rechtsgebied comes from the subjects prop first', () => {
	expect(caseArea({ subjects: ['Civiel recht'] }, strafHeading)).toBe('civiel');
	expect(caseArea({ subjects: ['Strafrecht'] }, null)).toBe('strafrecht');
	expect(caseArea({ subjects: ['Bestuursrecht'] }, null)).toBe('bestuursrecht');
	expect(caseArea({ subjects: ['Civiel recht; Ondernemingsrecht'] }, null)).toBe('civiel');
	expect(caseArea({ subjects: 'Belastingrecht' }, null)).toBe('bestuursrecht');
});

test('without subjects, the rechtsgebied follows the kamer, court or case number', () => {
	expect(caseArea({}, civielHeading)).toBe('civiel');
	expect(caseArea({}, strafHeading)).toBe('strafrecht');
	expect(caseArea({}, 'HOGE RAAD DER NEDERLANDEN\n\nBELASTINGKAMER')).toBe('bestuursrecht');
	expect(caseArea({ court: 'Raad van State' }, null)).toBe('bestuursrecht');
	expect(caseArea({ court: 'Centrale Raad van Beroep' }, null)).toBe('bestuursrecht');
	expect(caseArea({ case_number: '21-004300-25' }, null)).toBe('strafrecht');
	expect(caseArea({ case_number: 'C/15/329906 / HA ZA 22-419' }, null)).toBe('civiel');
	expect(caseArea({ case_number: '200.344.286/01' }, null)).toBe('civiel');
	expect(caseArea({ case_number: 'AMS 21/1234' }, null)).toBe('bestuursrecht');
	expect(caseArea({ court: 'Hoge Raad', case_number: '18/04298' }, null)).toBeNull();
	expect(caseArea(null, null)).toBeNull();
});

test('a civil judgment names eisers and verweerders, not a verdachte', () => {
	expect(extractParties(civielHeading, 'civiel')).toEqual([
		{ role: 'Eiser', name: '[eiseres 1]' },
		{ role: 'Eiser', name: '[eiser 2]' },
		{ role: 'Verweerder', name: 'MAATSCHAP GRONINGEN' },
		{ role: 'Verweerder', name: 'NEDERLANDSE AARDOLIE MAATSCHAPPIJ B.V.' },
		{ role: 'Verweerder', name: 'EBN B.V.' }
	]);
});

test('a criminal judgment names the verdachte', () => {
	expect(extractParties(strafHeading, 'strafrecht')).toEqual([
		{ role: 'Verdachte', name: '[verdachte]' }
	]);
});

test('a role the judgment states itself takes precedence', () => {
	const ontneming = `STRAFKAMER

op een vordering tot ontneming van wederrechtelijk verkregen voordeel ten laste

van

[betrokkene] ,

hierna: de betrokkene.`;
	expect(extractParties(ontneming, 'strafrecht')).toEqual([
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
	expect(extractParties(hogerBeroep, 'civiel')).toEqual([
		{ role: 'Appellant', name: '[appellant]' },
		{ role: 'Geïntimeerde', name: 'KLM N.V.' }
	]);
});

test('roles follow the rechtsgebied when the judgment states none', () => {
	const heading = `in de zaak van

[A]

tegen

[B]`;
	expect(extractParties(heading, 'civiel').map((p) => p.role)).toEqual(['Eiser', 'Verweerder']);
	expect(extractParties(heading, 'bestuursrecht').map((p) => p.role)).toEqual([
		'Appellant',
		'Verweerder'
	]);
	expect(extractParties(`beschikking\n\n${heading}`, 'civiel').map((p) => p.role)).toEqual([
		'Verzoeker',
		'Verweerder'
	]);
	expect(extractParties(heading, null).map((p) => p.role)).toEqual(['Partij', 'Partij']);
});

test('a place of residence is not taken for a name', () => {
	const heading = `in de zaak van

wonend te [plaats] ,

appellant,

tegen

gevestigd te Amstelveen,

geïntimeerde,`;
	expect(extractParties(heading, 'civiel')).toEqual([]);
});

test('a heading without "tegen" yields no parties', () => {
	expect(extractParties('Afdeling strafrecht\n\nParketnummer: 21-004300-25', 'strafrecht')).toEqual(
		[]
	);
});

// Headings below are shortened from real judgments; the ECLI names the source.

test('the head of the full text ends at the first section heading', () => {
	const text = `RECHTBANK AMSTERDAM
      Bestuursrecht
   uitspraak van de enkelvoudige kamer in de zaak tussen
   [eiser] , uit [plaats] , eiser
   en
   het college van burgemeester en wethouders van Amsterdam, verweerder
   Samenvatting
   1. Deze uitspraak gaat over het wegslepen van een auto.`;
	expect(judgmentHead(text).split('\n')).toEqual([
		'RECHTBANK AMSTERDAM',
		'Bestuursrecht',
		'uitspraak van de enkelvoudige kamer in de zaak tussen',
		'[eiser] , uit [plaats] , eiser',
		'en',
		'het college van burgemeester en wethouders van Amsterdam, verweerder'
	]);
});

test('"tussen … en" with the role after each name (ECLI:NL:RBAMS:2025:3600)', () => {
	const heading = `uitspraak van de meervoudige kamer van 3 juni 2025 in de zaak tussen
Moonflower B.V., uit Nunspeet, eiseres
(gemachtigde: mr. P.J. de Booij),
en
de minister van Infrastructuur en Waterstaat, verweerder
(gemachtigden: mr. S. Deaney en mr. T.W. Franssen).`;
	expect(extractParties(heading, 'bestuursrecht')).toEqual([
		{ role: 'Eiser', name: 'Moonflower B.V.' },
		{ role: 'Verweerder', name: 'de minister van Infrastructuur en Waterstaat' }
	]);
});

test('a hoger beroep at the Raad van State names the appellant once (ECLI:NL:RVS:2026:5642)', () => {
	const heading = `Uitspraak op de hoger beroepen van:
1. de minister van Sociale Zaken en Werkgelegenheid
2. [appellant], gevestigd in [woonplaats]
appellanten,
tegen de uitspraak van de rechtbank Gelderland van 9 juli 2025 in zaak nr. 24/6811 in het geding tussen:
[appellant]
en
de minister.`;
	expect(extractParties(heading, 'bestuursrecht')).toEqual([
		{ role: 'Appellant', name: 'de minister van Sociale Zaken en Werkgelegenheid' },
		{ role: 'Appellant', name: '[appellant]' }
	]);
});

test('"Partijen:" lists one party per line (ECLI:NL:CRVB:2025:1295)', () => {
	const heading = `Uitspraak op de hoger beroepen tegen de uitspraak van de rechtbank Limburg van
Partijen:
[Appellante] te [woonplaats] (appellante)
de Raad van bestuur van het Uitvoeringsinstituut werknemersverzekeringen (Uwv)`;
	expect(extractParties(heading, 'bestuursrecht')).toEqual([
		{ role: 'Appellant', name: '[Appellante]' },
		{
			role: 'Verweerder',
			name: 'de Raad van bestuur van het Uitvoeringsinstituut werknemersverzekeringen'
		}
	]);
});

test('a strafvonnis names the verdachte after "in de zaak tegen:" (ECLI:NL:RBAMS:2025:4828)', () => {
	const heading = `Vonnis van de rechtbank Amsterdam, meervoudige kamer voor de behandeling van strafzaken, in de zaak tegen:
[verdachte] ,
geboren te [geboorteplaats] op [geboortedatum] 1977,
ingeschreven in de Basisregistratie Personen op het adres
[adres] ,
hierna: verdachte.`;
	expect(extractParties(heading, 'strafrecht')).toEqual([
		{ role: 'Verdachte', name: '[verdachte]' }
	]);
});

test('one side only: a beklag by two klagers (ECLI:NL:RBAMS:2025:1014)', () => {
	const heading = `beslissing van de meervoudige raadkamer op het beklag van:
[klager 1] ,
geboren op [geboortedag] 1989,
en
[klager 2] ,
geboren op [geboortedag] 1990,`;
	expect(extractParties(heading, 'strafrecht')).toEqual([
		{ role: 'Klager', name: '[klager 1]' },
		{ role: 'Klager', name: '[klager 2]' }
	]);
});

test('a legal form takes the name on the next line (ECLI:NL:RBAMS:2025:8258)', () => {
	const heading = `in de zaak van
1 C MANAGEMENT B.V.,
2. C TELEPORT B.V. ,
beide gevestigd te Rotterdam,
eisende partijen bij dagvaarding van 20 oktober 2025,
advocaten: mr. M.A. Wielinga Carvajal en mr. G.A. Smit,
t e g e n
de rechtspersoon naar buitenlands recht
LETA CAPITAL FUND III LP ,
te Grand Cayman (Kaaimaneilanden),
gedaagde partij,`;
	expect(extractParties(heading, 'civiel')).toEqual([
		{ role: 'Eiser', name: 'C MANAGEMENT B.V.' },
		{ role: 'Eiser', name: 'C TELEPORT B.V.' },
		{ role: 'Gedaagde', name: 'LETA CAPITAL FUND III LP' }
	]);
});

test('an anonymised legal form takes its aanduiding (ECLI:NL:GHAMS:2026:2707)', () => {
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
	expect(extractParties(heading, 'civiel')).toEqual([
		{ role: 'Verzoeker', name: '[Aandeelhouder 1]' },
		{ role: 'Verzoeker', name: '[Aandeelhouder 2]' },
		{ role: 'Verweerder', name: '[Aandeelhouder 3]' },
		{ role: 'Belanghebbende', name: '[de Vennootschap]' }
	]);
});

test('a heading after the last party is not a party (ECLI:NL:HR:2019:1278)', () => {
	const heading = `${civielHeading}

4. DE STAAT DER NEDERLANDEN,

VERWEERDER in eerste aanleg,

1 De prejudiciële procedure`;
	expect(extractParties(heading, 'civiel').at(-1)).toEqual({
		role: 'Verweerder',
		name: 'DE STAAT DER NEDERLANDEN'
	});
});

test('placeholders for an address or a V-nummer are not parties', () => {
	const heading = `in de zaak tegen:
[verdachte] ,
geboren op [geboortedag] 2001 in [geboorteplaats] ,
inschrijvingsadres in de Basisregistratie Personen:
[BRP-adres] .`;
	expect(extractParties(heading, 'strafrecht')).toEqual([
		{ role: 'Verdachte', name: '[verdachte]' }
	]);
});

test('the full text is read when the subheading misses the party block', () => {
	const judgment = {
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
			{
				kind: 'subheading',
				text: 'Afdeling strafrecht\n\nParketnummer: 21-004300-25\n\ngeboren op [geboortedatum] 1987'
			}
		]
	};
	expect(judgmentParticipants(judgment)).toEqual([{ role: 'Verdachte', name: '[verdachte]' }]);
	expect(judgmentParticipants({ ...judgment, props: { subjects: ['Strafrecht'] } })).toEqual([]);
});

test('"mr. X voornoemd en mr. Y" names two lawyers', () => {
	const paragraphs = [
		{
			kind: 'body',
			text: 'Namens KLM hebben mr. Van Slooten voornoemd en mr. J. Boer, beiden advocaat te Amsterdam, het woord gevoerd.'
		}
	];
	expect(extractParticipants(paragraphs, []).map((p) => p.name)).toEqual([
		'mr. Van Slooten',
		'mr. J. Boer'
	]);
});

// ── Parties from the API (`JudgmentDTO.parties`, API 0.11) ──────────────────

test('the parties the API read come first, each followed by its lawyers', () => {
	const judgment = {
		props: { subjects: ['Civiel recht'], text: 'in de zaak van\n[X]\ntegen\n[Y]' },
		paragraphs: [
			{
				kind: 'body',
				text: 'Namens eisers heeft mr. H.J.W. Alt, advocaat te Amsterdam, het woord gevoerd.'
			}
		],
		parties: [
			{
				name: '[eiseres 1]',
				role: 'Eiser',
				role_stated: true,
				side: 'first',
				alias: '[eisers]',
				representatives: [{ name: 'mr. H.J.W. Alt', role: 'advocaat' }]
			},
			{
				name: 'MAATSCHAP GRONINGEN',
				role: 'Verweerder',
				role_stated: false,
				side: 'second',
				alias: 'de Maatschap',
				representatives: []
			}
		]
	};
	expect(judgmentParticipants(judgment)).toEqual([
		{ role: 'Eiser', name: '[eiseres 1]', stated: true },
		{ role: 'Advocaat', name: 'mr. H.J.W. Alt', party: '[eisers]' },
		{ role: 'Verweerder', name: 'MAATSCHAP GRONINGEN', stated: false, alias: 'de Maatschap' }
	]);
});

test('an empty list from the API means the kop names no parties', () => {
	const judgment = {
		props: { subjects: ['Strafrecht'], text: 'in de strafzaak tegen\n[verdachte] ,' },
		paragraphs: [],
		parties: []
	};
	expect(judgmentParticipants(judgment)).toEqual([]);
});

test('without parties from the API, the reader reads the full text', () => {
	const judgment = {
		props: { subjects: ['Strafrecht'], text: 'in de strafzaak tegen\n[verdachte] ,' },
		paragraphs: []
	};
	expect(judgmentParticipants(judgment)).toEqual([{ role: 'Verdachte', name: '[verdachte]' }]);
	expect(judgmentParticipants({ ...judgment, parties: null })).toEqual([
		{ role: 'Verdachte', name: '[verdachte]' }
	]);
});

test('a lawyer in the kop is not repeated from the body', () => {
	const paragraphs = [
		{
			kind: 'body',
			text: 'Namens de Staat heeft mr. K. Teuben, advocaat te Den Haag, het woord gevoerd.'
		}
	];
	const parties = [
		{ role: 'Verweerder', name: 'DE STAAT DER NEDERLANDEN' },
		{ role: 'Advocaat', name: 'Mr. K. Teuben', party: 'de Staat' }
	];
	expect(extractParticipants(paragraphs, parties)).toEqual(parties);
});

test('a lawyer for several parties in a row is one row after them (ECLI:NL:HR:2019:1278)', () => {
	const bie = { name: 'Mr. J. de Bie Leuveling Tjeenk', role: 'advocaat' as const };
	const party = (name: string, alias: string, representatives = [bie]) => ({
		name,
		role: 'Verweerder',
		role_stated: true,
		side: 'second' as const,
		alias,
		representatives
	});
	const parties = [
		party('MAATSCHAP GRONINGEN', 'de Maatschap'),
		party('NEDERLANDSE AARDOLIE MAATSCHAPPIJ B.V.', 'NAM'),
		party('EBN B.V.', 'EBN', [{ name: 'mr. J.F. de Groot', role: 'advocaat' }])
	];
	expect(
		judgmentParticipants({ paragraphs: [], parties }).map((p) => [p.role, p.name, p.party])
	).toEqual([
		['Verweerder', 'MAATSCHAP GRONINGEN', undefined],
		['Verweerder', 'NEDERLANDSE AARDOLIE MAATSCHAPPIJ B.V.', undefined],
		['Advocaat', 'Mr. J. de Bie Leuveling Tjeenk', 'de Maatschap, NAM'],
		['Verweerder', 'EBN B.V.', undefined],
		['Advocaat', 'mr. J.F. de Groot', 'EBN']
	]);
});

describe('partiesByRole', () => {
	it('counts pseudonymised parties and lists the named ones, by role', () => {
		const appellants = Array.from({ length: 116 }, (_, i) => ({
			role: 'Appellant',
			name: `[appellant ${i + 1}]`
		}));
		const groups = partiesByRole([
			...appellants,
			{ role: 'Advocaat', name: 'mr. M.A. de Jager', party: '[appellant 1]' },
			{ role: 'Geïntimeerde', name: 'KONINKLIJKE LUCHTVAART MAATSCHAPPIJ N.V.' },
			{ role: 'Geïntimeerde', name: 'VERENIGING NEDERLANDSE VERKEERSVLIEGERS' },
			{ role: 'Eiser', name: '[eiser]', stated: false }
		]);
		expect(groups.map((g) => [g.role, g.named.length, g.anonymous.length, g.derived])).toEqual([
			['Appellant', 0, 116, false],
			['Geïntimeerde', 2, 0, false],
			['Eiser', 1, 0, true],
			['Advocaat', 1, 0, false]
		]);
	});
});

describe('forParties', () => {
	it('counts the pseudonymised parties a lawyer acts for', () => {
		const many = Array.from({ length: 116 }, (_, i) => `[appellant ${i + 1}]`).join(', ');
		expect(forParties(many)).toBe('116 geanonimiseerde partijen');
		expect(forParties('KLM, [eiser 1] en [eiser 2]')).toBe('KLM en 2 geanonimiseerde partijen');
		expect(forParties('[appellant]')).toBe('[appellant]');
	});
});

describe('judgmentParticipants from the API', () => {
	it('keeps the alias and the other roles of a party', () => {
		const [vnv] = judgmentParticipants({
			parties: [
				{
					name: 'VERENIGING NEDERLANDSE VERKEERSVLIEGERS',
					role: 'Geïntimeerde',
					roles: ['Geïntimeerde', 'Appellant'],
					alias: 'VNV',
					role_stated: true
				}
			]
		});
		expect([vnv.alias, vnv.alsoAs]).toEqual(['VNV', ['Appellant']]);
	});
});
