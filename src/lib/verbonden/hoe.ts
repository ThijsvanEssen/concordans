// What a row of Verbonden says about its verbinding, at a glance (Thijs, 10 Oct: "weinig over
// wát er verbonden wordt of hóé; dat is nou juist interessant om in één oogopslag te kunnen
// zien"). One line in legal or parliamentary words, the verb fixed per relation and direction,
// the rest read from the edge: the lid, the places, the count, the day, the vote. Under it the
// passage that carries the verbinding, and where the verbinding comes from (shown on hover or
// focus). "Deze" and "dit" are the selected bron, as in the group labels.
//
// The words of a verbinding have one source, here (`woordenVan`): per relation, the
// collections at its two ends and what its meta says. The row, the line on the canvas, the
// line between two hulls, the legend, the table, the CSV and the card Verbinding all read
// them, so one verbinding is never called two things (onderzoek samenhang, 14 Oct).
import type { Collection, Relation } from '$lib/vocabulary';
import { langeDatum } from '$lib/text/datum';
import {
	grondslagRegel,
	grondslagWerkwoord,
	ledenTekst,
	uitgewerktIn,
	type Grondslag
} from '$lib/text/delegaties';
import { passageOf, type Row } from './rows';
import { uitsnede, type Passage } from './passage';
import { confidenceWord } from './filter';

/** The words of one verbinding, by its relation, its two ends and its meta. */
export type Woorden = {
	/** Read from the source to the target, lower case: `haalt aan`, `bijlage bij`, `diende in`. */
	actief: string;
	/**
	 * The word of a row where the selected bron is the source and the row's bron the target,
	 * lower case: `aangehaald` (a judgment's article), `wijzigt` (a Staatsblad's article).
	 */
	terug: string;
	/** What the verbinding is, the head of the card: `verwijzing in een uitspraak`. */
	soort: string;
};

type Ends = { van: Collection | null; naar: Collection | null; meta: Record<string, unknown> };
type W = readonly [actief: string, terug: string, soort: string];

const tekstVan = (v: unknown): string | null =>
	typeof v === 'string' && v.trim() ? v.trim() : null;

/** The kind of a change by its effect on wetten.overheid.nl, where the edge gives one. */
const EFFECT: Record<string, Relation> = {
	'nieuwe-regeling': 'ESTABLISHES',
	wijziging: 'AMENDS',
	nieuw: 'INTRODUCES',
	vervallen: 'REPEALS'
};

/** The bron in which a verbinding stands, for the head of the card. */
const IN_EEN: Partial<Record<Collection, string>> = {
	judgments: 'in een uitspraak',
	documents: 'in een Kamerstuk',
	articles: 'in een artikel',
	instruments: 'in een wet',
	dossiers: 'in een dossier'
};

const inEen = (noun: string, van: Collection | null) =>
	van && IN_EEN[van] ? `${noun} ${IN_EEN[van]}` : noun;

/** Of a change: the article or the law it changes. */
const vanEen = (naar: Collection | null) =>
	naar === 'articles' ? 'van een artikel' : 'van een wet';

/**
 * Per relation, its words. The source collection decides who speaks: a judgment `haalt aan`,
 * an article `verwijst naar`, a Kamerstuk `noemt`.
 */
const WOORDEN: Record<Relation, (e: Ends) => W> = {
	PART_OF: ({ van, naar }) =>
		van === 'documents' && naar === 'dossiers'
			? ['stuk in', 'dossier van', 'stuk in een dossier']
			: van === 'documents'
				? ['stuk bij', 'zaak van', 'stuk bij een zaak']
				: van === 'cases'
					? ['zaak in', 'dossier van', 'zaak in een dossier']
					: van === 'instruments'
						? ['onderdeel van', 'omvat', 'onderdeel van een verdrag']
						: van === 'annexes'
							? ['bijlage bij', 'wet van', 'bijlage bij een wet']
							: van === 'articles'
								? ['artikel van', 'wet van', 'artikel van een wet']
								: ['onderdeel van', 'omvat', 'onderdeel'],
	VERSION_OF: () => ['versie van', 'versie', 'versie'],
	// The publication that enacted a new regulation set its articles (BWB `nieuwe-regeling`).
	ESTABLISHES: ({ naar }) => ['stelt vast', 'vastgesteld bij', `vaststelling ${vanEen(naar)}`],
	AMENDS: ({ naar }) => ['wijzigt', 'wijzigt', `wijziging ${vanEen(naar)}`],
	INTRODUCES: ({ naar }) => ['voegt in', 'voegt in', `invoeging ${vanEen(naar)}`],
	// An article vervalt; a law is ingetrokken (Aanwijzingen voor de regelgeving).
	REPEALS: ({ naar }) =>
		naar === 'instruments'
			? ['trekt in', 'trekt in', 'intrekking van een wet']
			: ['doet vervallen', 'doet vervallen', 'vervallen van een artikel'],
	// A preamble that names an article without the power the regulation is made under in it
	// (`basis_kind` mentioned, Awb 3:2 and 3:4) only names it.
	BASED_ON: ({ meta }) =>
		tekstVan(meta.basis_kind) === 'mentioned'
			? [
					'noemt in de aanhef',
					'genoemd in de aanhef van',
					'vermelding in de aanhef van een regeling'
				]
			: ['gebaseerd op', 'gebaseerd op', 'grondslag in de aanhef van een regeling'],
	IMPLEMENTS: () => ['implementeert', 'implementeert', 'implementatie van EU-recht'],
	LEGISLATED_IN: () => ['tot stand gekomen in', 'tot stand gekomen in', 'wetsvoorstel van een wet'],
	PUBLISHED_IN: () => ['gepubliceerd in', 'gepubliceerd in', 'publicatie in het Tractatenblad'],
	REFERS_TO: ({ van }) =>
		van === 'judgments'
			? ['haalt aan', 'aangehaald', 'verwijzing in een uitspraak']
			: van === 'documents'
				? ['noemt', 'genoemd', 'verwijzing in een Kamerstuk']
				: van === 'instruments'
					? ['noemt', 'genoemd', 'vermelding in een wet']
					: ['verwijst naar', 'verwijst naar', inEen('verwijzing', van)],
	EXPLAINS: ({ naar }) => [
		'licht toe',
		'toegelicht in',
		naar === 'instruments' ? 'toelichting bij een wet' : 'toelichting bij een artikel'
	],
	APPEAL_OF: ({ meta }) => {
		const aard = tekstVan(meta.procedure_type)?.toLowerCase() ?? 'hoger beroep';
		return [`${aard} tegen`, `bestreden in ${aard}`, aard];
	},
	ADVISES_ON: () => ['conclusie bij', 'uitspraak op', 'conclusie in dezelfde zaak'],
	ANSWERS: ({ van, naar }) =>
		van === 'judgments'
			? [
					'beantwoordt prejudiciële vragen van',
					'prejudiciële vragen beantwoord in',
					'prejudiciële beslissing'
				]
			: naar === 'commitments'
				? ['komt na', 'nagekomen', 'nakoming van een toezegging']
				: ['gaat in op', 'besproken', 'beantwoording in een brief'],
	CONTINUES: ({ van }) =>
		van === 'activities'
			? ['vervangt', 'vervangen door', 'verplaatsing van een activiteit']
			: ['vervolg op', 'voortgezet in', 'vervolg in dezelfde zaak'],
	REFERRED_BY: () => ['verwezen door', 'verwees naar', 'verwijzing na cassatie'],
	// One decision, two publications; one stuk of the Staatsblad, two copies; one person.
	SAME_AS: ({ van }) =>
		van === 'judgments'
			? ['zelfde uitspraak als', 'ook gepubliceerd als', 'andere publicatie van een uitspraak']
			: van === 'members'
				? ['zelfde persoon als', 'zelfde persoon als', 'zelfde persoon']
				: van === 'documents'
					? ['zelfde publicatie als', 'zelfde publicatie als', 'andere uitgave van een publicatie']
					: van === 'instruments'
						? ['tekst van', 'tekst in het BWB', 'zelfde verdrag']
						: ['zelfde bron als', 'zelfde bron als', 'zelfde bron'],
	SCOPED_BY: () => ['begrensd door', 'begrenst', 'reikwijdte in een bijlage'],
	ABOUT: ({ van }) =>
		van === 'decisions'
			? ['over', 'onderwerp van', 'stemming over een zaak']
			: van === 'commitments'
				? ['over', 'onderwerp van', 'toezegging in een dossier']
				: ['over', 'onderwerp van', 'activiteit over een zaak'],
	LED_BY: () => ['onder leiding van', 'voortouw bij', 'voortouwcommissie'],
	MADE_IN: ({ van }) =>
		van === 'commitments'
			? ['toegezegd in', 'toegezegd in', 'toezegging in een activiteit']
			: van === 'decisions'
				? ['genomen in', 'genomen in', 'stemming in een activiteit']
				: van === 'documents'
					? ['verslag van', 'verslag van', 'verslag van een debat']
					: ['gedaan in', 'gedaan in', 'gedaan in een activiteit'],
	MEMBER_OF: () => ['lid van', 'lid', 'lidmaatschap'],
	SERVED_IN: () => ['bewindspersoon in', 'bewindspersoon', 'ambt in een kabinet'],
	// The edge runs from the member to the stuk: read from there, a member diende in. One who
	// signed as minister or for the Kamer, not as Kamerlid, ondertekende.
	AUTHORED: ({ naar, meta }) => {
		if (naar === 'commitments') return ['deed', 'gedaan door', 'toezegging'];
		const functie = tekstVan(meta.function);
		const capacity = tekstVan(meta.capacity);
		return capacity && capacity !== 'kamerlid'
			? [
					functie ? `ondertekende als ${functie}` : 'ondertekende',
					'ondertekend door',
					'ondertekening'
				]
			: ['diende in', 'ingediend door', 'indiening'];
	},
	VOTED: ({ meta }) => {
		const keuze = tekstVan(meta.choice)?.toLowerCase();
		return [
			keuze === 'voor' || keuze === 'tegen' ? `stemde ${keuze}` : 'stemde over',
			'gestemd door',
			'stem'
		];
	},
	// A supplementary budget revises its chapter (Dossier → Dossier); an amended motion or
	// amendment replaces the one it names (Document → Document, `rule` vervanging).
	REVISES: ({ van, meta }) =>
		van === 'documents' || tekstVan(meta.rule) === 'vervanging'
			? ['vervangt', 'vervangt', 'vervanging van een motie of amendement']
			: tekstVan(meta.rule) === 'slotwet'
				? ['slotwet bij', 'slotwet bij', 'slotwet bij een begroting']
				: ['wijzigt de begroting', 'wijzigt de begroting', 'wijziging van een begroting'],
	// A budget change is submitted with its nota (Dossier → Dossier); a bijlage goes with
	// its letter (Document → Document).
	ACCOMPANIES: ({ van }) =>
		van === 'documents'
			? ['bijlage bij', 'bijlage bij', 'bijlage bij een brief']
			: ['ingediend met', 'ingediend met', 'indiening met een nota'],
	RELATED_TO: ({ van }) =>
		van === 'judgments'
			? ['samenhangend met', 'samenhangend met', 'samenhangende zaak']
			: van === 'dossiers' || van === 'cases'
				? [
						'door de Kamer verbonden met',
						'door de Kamer verbonden met',
						van === 'dossiers' ? 'verband tussen zaken in een dossier' : 'verband tussen zaken'
					]
				: ['verbonden met', 'verbonden met', 'verband'],
	SECOND_READING_OF: () => ['tweede lezing van', 'tweede lezing van', 'tweede lezing']
};

/**
 * The relations the API's catalogue has (lawgraph docs/data-model.md) that the reader never
 * sees as a verbinding, each with the reason. Every other relation has its words here, for
 * every pair of collections the catalogue lets it join (guard: hoe.test.ts).
 */
export const ZONDER_WOORDEN: Partial<Record<Relation, string>> = {
	VERSION_OF:
		'Een versie is de bron zelf op een dag: de lezer bladert erdoor, Verbonden en het netwerk tonen haar niet als verbinding.'
};

/**
 * The words of a verbinding: the relation, the collection of its source (`van`) and of its
 * target (`naar`), and its meta where the edge carries one (`procedure_type`, `rule`,
 * `function`, `effect`). Without collections, the words of the relation in general.
 */
export function woordenVan(
	relation: Relation,
	van?: Collection | null,
	naar?: Collection | null,
	meta?: Record<string, unknown> | null
): Woorden {
	const m = meta ?? {};
	// A change of an article by its effect: an AMENDS whose effect is `vervallen` repeals.
	const effect = EFFECT[tekstVan(m.effect) ?? ''];
	const r =
		effect &&
		(relation === 'ESTABLISHES' ||
			relation === 'AMENDS' ||
			relation === 'INTRODUCES' ||
			relation === 'REPEALS')
			? effect
			: relation;
	const [actief, terug, soort] = WOORDEN[r]({ van: van ?? null, naar: naar ?? null, meta: m });
	return { actief, terug, soort };
}

/**
 * The label of a verbinding, read from its source: `haalt aan`, `verwijst naar`, `noemt`,
 * `diende in`. What the canvas, the legend, the table and the CSV say.
 */
export const relationLabel = (
	relation: Relation,
	van?: Collection | null,
	naar?: Collection | null,
	meta?: Record<string, unknown> | null
): string => woordenVan(relation, van, naar, meta).actief;

/** What the verbinding is, for the head of the card Verbinding: `verwijzing in een uitspraak`. */
export const soortVan = (
	relation: Relation,
	van?: Collection | null,
	naar?: Collection | null,
	meta?: Record<string, unknown> | null
): string => woordenVan(relation, van, naar, meta).soort;

/**
 * A word of the line in the meta letter: `Herkend in de tekst` reads `herkend in de tekst`
 * after a comma. A name keeps its capital: the Tweede Kamer, the ECLI.
 */
export const kleineLetter = (s: string) =>
	/^[A-Z][a-z]/.test(s) && !/^(Tweede|Eerste) Kamer\b/.test(s)
		? s.charAt(0).toLowerCase() + s.slice(1)
		: s;

export type Hoe = {
	/** The verb, in weight: `Haalt aan`, `Wijzigt`, `Door de Kamer verbonden`. */
	werkwoord: string | null;
	/**
	 * What follows it: `lid 3, in r.o. 4.3 en 5.1`, `dit artikel, in werking 1 juli 2024`. A
	 * statement rather than a verb carries its own sign: `: 2 zaken`, `, 27 voor en 123 tegen`.
	 */
	rest: string | null;
	/** Derived or below full confidence: the line in italics, with "afgeleid". */
	afgeleid: boolean;
	/** The passage of the source with the words that name the selected bron. */
	citaat: Passage | null;
	/**
	 * The words in `rest` that name the paragraph the passage is in (`r.o. 3.4`), and its
	 * anchor: a link that opens the citing judgment there.
	 */
	plaats: { text: string; at: string; noot: string | null } | null;
	/** Where the verbinding comes from, for hover and focus. */
	herkomst: string | null;
};

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const keer = (n: number | null) => (n && n > 1 ? `${n} keer` : null);
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ') || null;
const erbij = (teken: string, s: string | null) => (s ? `${teken}${s}` : null);
const groot = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `Stb.2021-162` and `stb_2021_162` as they are cited: `Stb. 2021, 162`. */
export const publicatie = (s: string | null) =>
	s
		?.replace(/^(stb|stcrt|trb)_(\d{4})_(\d+)$/i, (_, k: string, j, n) => `${groot(k)}.${j}-${n}`)
		.replace(/^(Stb|Stcrt|Trb)\.?\s*(\d{4})-(\d+)$/, '$1. $2, $3') ?? null;

export const HERKOMST_REDEN: Record<string, string> = {
	bwb_xml_ref: 'Verwijzing in de wettekst, wetten.overheid.nl',
	bwb_article: 'Herkend in de tekst',
	ecli: 'ECLI genoemd in de tekst'
};

/**
 * The words of `rest` that name the paragraph `at` (`rov-3.4`): `r.o. 3.4` in `in r.o. 3.4`,
 * `5.1` in `in r.o. 3.4 en 5.1`. Null where the line does not name it.
 */
export function plaatsIn(
	rest: string | null,
	at: string | null | undefined,
	noot: { id: string; label: string | null } | null = null
): { text: string; at: string; noot: string | null } | null {
	if (!rest) return null;
	const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// The note the citation stands in goes with the place: `r.o. 5.7.6 (voetnoot 35)`.
	const inNoot = noot?.label ? `(?:\\s*\\(voetnoot ${esc(noot.label)}\\))?` : '';
	if (!at?.startsWith('rov-')) {
		// A note of a Kamerstuk, without an r.o.: `voetnoot 71`.
		if (!noot?.label) return null;
		const m = new RegExp(`voetnoot ${esc(noot.label)}(?![\\w.])`).exec(rest);
		// The stuk opens at the note itself: its anchor.
		const anker = noot.id;
		return m ? { text: m[0], at: anker, noot: anker } : null;
	}
	const n = esc(at.slice(4));
	const m =
		new RegExp(`(?:r\\.o\\.|onder|§)\\s*${n}(?![\\w.])${inNoot}`).exec(rest) ??
		new RegExp(`(?<=\\s)${n}(?![\\w.])${inNoot}`).exec(rest);
	return m ? { text: m[0], at, noot: noot && m[0].includes('voetnoot') ? noot.id : null } : null;
}

/** Where an edge comes from by its `basis`, where it has no `reason`. */
const HERKOMST_BASIS: Partial<Record<string, string>> = {
	subject: 'Onderwerp van het Kamerstuk'
};

/** The selected bron as the object of a line: `Verwijst naar dit artikel`. */
const DIT: Partial<Record<Collection, string>> = {
	articles: 'dit artikel',
	documents: 'dit stuk',
	instruments: 'deze wet',
	judgments: 'deze uitspraak',
	dossiers: 'dit dossier'
};

/**
 * The line of a row: what the verbinding between the selected bron (`selected`, its
 * collection) and the row's bron is. Null where the group's label says all (a Kamerstuk in
 * its dossier, a lid of a fractie) and the edge adds nothing.
 */
export function hoeVan(row: Row, selected: Collection): Hoe | null {
	const edge = row.edge ?? {};
	const props = (row.props ?? {}) as Record<string, unknown>;
	const other = row.ref.collection;
	const inbound = row.direction === 'inbound';
	// Derived, or below high confidence: as the filter Betrouwbaarheid grades it (0.9 and up
	// is high; a citation recognised in the text has 0.95).
	const afgeleid = confidenceWord(row.confidence, !!row.derived) !== 'hoog';
	const p = passageOf(row);
	const citaat = p?.mark ? uitsnede(p) : null;
	const lid = row.lid ? `lid ${row.lid}` : null;
	// The place in the citing text: `in r.o. 4.3 en 5.1`.
	const plaats = row.position && row.position !== lid ? `in ${row.position}` : null;
	const reden = text(edge.reason);
	const uit = (s: string | null) => (s ? (HERKOMST_REDEN[s] ?? null) : null);
	const formeel = text(edge.basis) === 'formal_relation' ? 'Rechtspraak.nl, formele relatie' : null;
	const regel = (werkwoord: string | null, rest: string | null, herkomst: string | null) =>
		({
			werkwoord,
			rest,
			afgeleid,
			citaat,
			plaats: citaat ? plaatsIn(rest, row.passageAt, row.noot ?? null) : null,
			herkomst
		}) satisfies Hoe;
	// The words of the relation, read from its source: the row's where it points here.
	const woorden = row.relation
		? woordenVan(row.relation, inbound ? other : selected, inbound ? selected : other, edge)
		: null;

	switch (row.relation) {
		case 'RELATED_TO': {
			if (other !== 'dossiers' || selected !== 'dossiers') break;
			const zaken = num(edge.cases);
			const soorten = Array.isArray(edge.case_kinds)
				? edge.case_kinds.filter((k): k is string => typeof k === 'string').join('; ')
				: null;
			return regel(
				'Door de Kamer verbonden',
				erbij(
					': ',
					join(zaken ? `${zaken} ${zaken === 1 ? 'zaak' : 'zaken'}` : null, soorten?.toLowerCase())
				),
				'Tweede Kamer, zaak gerelateerd aan zaak'
			);
		}
		case 'APPEAL_OF': {
			const aard = row.aard ?? text(edge.procedure_type)?.toLowerCase() ?? 'hoger beroep';
			return inbound
				? regel(`${groot(aard)} tegen`, 'deze uitspraak', formeel)
				: regel('Bestreden', `in ${aard} met deze uitspraak`, formeel);
		}
		case 'BASED_ON': {
			// A regulation under a law or an article, by its kind: `AMvB op grond van art. 3, 16
			// lid 1 en 7` on the law, `AMvB op grond van lid 1 en 7` on the article; one under a
			// regulation under the law, `Ministeriële regeling op grond van art. 19, 23, 28
			// Cyberbeveiligingsbesluit` (delegaties.ts). Then the articles that work it out.
			const basis = text(edge.basis_kind);
			const grondslag = edge.grondslag as Grondslag | undefined;
			if (!inbound && !grondslag) break;
			const lijn = grondslag
				? grondslagRegel(grondslag)
				: {
						werkwoord: grondslagWerkwoord(text(props.kind), basis),
						rest:
							selected === 'instruments'
								? (row.position ?? null)
								: selected === 'articles'
									? (ledenTekst(edge.leden) ?? 'dit artikel')
									: null
					};
			if (!lijn.rest) break;
			return regel(lijn.werkwoord, join(lijn.rest, uitgewerktIn(edge.referring)), uit(reden));
		}
		case 'ADVISES_ON':
			return inbound
				? regel('Conclusie bij', 'deze uitspraak', formeel)
				: regel('Uitspraak op', 'deze conclusie', formeel);
		case 'ESTABLISHES':
		case 'AMENDS':
		case 'INTRODUCES':
		case 'REPEALS': {
			const effect = text(edge.effect);
			// The publication that enacted a law, among those that change it (`/amended-by`,
			// `establishes`): `Stelt vast`, its day in the meta line.
			const vastgesteld = woorden?.actief === 'stelt vast';
			if (vastgesteld && num(edge.establishes)) return regel('Stelt vast', null, null);
			// A row from the legislative history carries its change in its own meta line.
			if (!effect && !text(edge.effective_date) && !text(edge.source_publication)) return null;
			const werkwoord = effect === 'vernummering' ? 'Vernummert' : groot(woorden!.actief);
			const datum = text(edge.effective_date);
			const pub = publicatie(text(edge.source_publication));
			const wat = join(
				lid,
				datum ? `in werking ${langeDatum(datum)}` : row.proposed ? 'voorgesteld' : null
			);
			return regel(
				werkwoord,
				// The article it changes, where it is the selected one: `Wijzigt dit artikel, in
				// werking …`; else the row names it, and the rest follows a comma. A separable verb
				// takes no object after it: `Stelt vast, in werking …`.
				inbound && !vastgesteld
					? join(`dit ${selected === 'articles' ? 'artikel' : 'onderdeel'}`, wat)
					: erbij(', ', wat),
				pub ? `Wetten.overheid.nl, ${pub}` : row.proposed ? 'Voorstel van wet' : null
			);
		}
		case 'LEGISLATED_IN': {
			if (inbound)
				return regel(
					'Tot stand gekomen',
					'in dit dossier',
					text(edge.dossier_number) ? 'Dossiernummer in de publicatie' : null
				);
			// The dossiers of a wet: the bill that made it, or a bill whose publication amended
			// it (`via`, /api/instruments/{bwb}/dossiers). What the dossier is to the wet, in the
			// Kamer's words; its kind and number stand under it ("Kamerstuk 36764").
			const pub = publicatie(text(edge.publication));
			return text(edge.via) === 'amending_publication'
				? regel('Wijzigt', join('deze wet', pub), null)
				: regel('Wetsvoorstel', 'van deze wet', null);
		}
		case 'ANSWERS':
			// A letter of the government and the motion its subject names: `Gaat in op`. A
			// prejudiciële beslissing says it in its group's label.
			if (other !== 'documents' || selected !== 'documents') break;
		// falls through
		case 'REFERS_TO': {
			// Two laws, by the references between their articles (`related-instruments`): the
			// grondslag where one is issued under the other, else the articles in force that refer,
			// which way: `17 artikelen verwijzen naar deze wet`.
			const naar = num(edge.inbound_count);
			const vanuit = num(edge.outbound_count);
			if (naar != null || vanuit != null) {
				const grondslag = edge.grondslag as Grondslag | undefined;
				if (grondslag) {
					const g = grondslagRegel(grondslag);
					return regel(g.werkwoord, g.rest, null);
				}
				const dit = text(edge.dit) ?? 'deze wet';
				const artikelen = (n: number) => `${n} ${n === 1 ? 'artikel' : 'artikelen'}`;
				const verwijzen = (n: number) => (n === 1 ? 'verwijst' : 'verwijzen');
				const hierheen = naar ? `${artikelen(naar)} ${verwijzen(naar)} naar ${dit}` : null;
				const daarheen = vanuit
					? `${artikelen(vanuit)} van ${dit} ${naar ? 'ernaar' : `${verwijzen(vanuit)} ernaar`}`
					: null;
				return regel(null, join(hierheen, daarheen), null);
			}
			// The aard where it says more than that it refers: `als voorwaarde`, not `als verwijzing`.
			const aard =
				row.aard && !/^(mogelijk )?verwijzing$/.test(row.aard)
					? row.aard.replace(/^(mogelijk )?/, (m) => `${m}als `)
					: null;
			// An article of the law and the article it refers to, by its aard: `Verwijst naar
			// art. 6:214 BW, als voorwaarde`.
			const doel = text(edge.doel);
			if (doel) return regel('Verwijst naar', join(doel, aard), uit(reden));
			const vaak = keer(num(edge.mention_count) ?? (row.mentions?.length || null));
			// The words of the source, where they are not the passage under the line.
			const eigen = !citaat && text(edge.text) ? `‘${text(edge.text)}’` : null;
			const herkomst =
				uit(reden) ??
				HERKOMST_BASIS[text(edge.basis) ?? ''] ??
				(text(edge.cited_ecli)
					? HERKOMST_REDEN.ecli
					: row.snippet || row.match
						? 'Herkend in de tekst'
						: null);
			// A verb with an object names it before the rest: `Verwijst naar lid 2`, `Verwijst
			// naar dit artikel als ‘…’`, `Verwijst ernaar als ‘…’`, never `Verwijst naar als`. A
			// participle needs none: `Aangehaald in r.o. 6`.
			const woord = groot(inbound ? woorden!.actief : woorden!.terug);
			const deelwoord = /^(Aangehaald|Genoemd|Besproken)$/.test(woord);
			const zonderLid = !lid && !deelwoord && !!(eigen || aard);
			const werkwoord = zonderLid && !inbound ? woord.replace(/ naar$/, ' ernaar') : woord;
			const object = lid ?? (zonderLid && inbound ? (DIT[selected] ?? null) : null);
			const kern = join(object, plaats, vaak, aard);
			return regel(
				werkwoord,
				eigen
					? aard
						? `${kern}: ${eigen}`
						: [kern, `als ${eigen}`].filter(Boolean).join(' ')
					: kern,
				herkomst
			);
		}
		case 'VOTED': {
			// A fractie's vote on the decision: `Tegen, 7 zetels`.
			const keuze = text(edge.choice);
			if (!keuze || !inbound) break;
			const zetels = num(edge.seats);
			return regel(
				groot(keuze.toLowerCase()),
				zetels ? `, ${zetels} ${zetels === 1 ? 'zetel' : 'zetels'}` : null,
				null
			);
		}
		case 'PUBLISHED_IN': {
			// What the Tractatenblad publishes of the treaty, as the Verdragenbank writes it.
			const wat = text(edge.description);
			if (wat) return regel(null, wat, 'Verdragenbank');
			break;
		}
		case 'ABOUT': {
			if (other !== 'decisions') break;
			const besluit =
				text(props.decision_text)?.replace(/\.$/, '') ??
				(props.passed === true ? 'Aangenomen' : props.passed === false ? 'Verworpen' : null);
			if (!besluit) break;
			const tally = (props.tally ?? {}) as Record<string, unknown>;
			const voor = num(tally.Voor);
			const tegen = num(tally.Tegen);
			return regel(
				besluit,
				voor != null && tegen != null ? `, ${voor} voor en ${tegen} tegen` : null,
				'Besluit van de Kamer'
			);
		}
	}
	// The group's label names it (a Kamerstuk in its dossier, a lid in a fractie): only
	// what the edge adds, else nothing.
	if (afgeleid || citaat || lid || plaats) {
		const label = woorden ? (inbound ? woorden.actief : woorden.terug) : null;
		return regel(label ? groot(label) : null, join(lid, plaats), uit(reden));
	}
	return null;
}
