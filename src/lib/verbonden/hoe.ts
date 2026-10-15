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
import { capitalize, count, escapeRegExp, lowerFirst, plural, textOf } from '$lib/text/words';
import { atPlace, paragraphNumber } from '$lib/text/anchor';
import {
	isChangeRelation,
	type ChangeRelation,
	type Collection,
	type Relation
} from '$lib/vocabulary';
import { langeDatum } from '$lib/text/datum';
import {
	grondslagRegel,
	grondslagWerkwoord,
	ledenTekst,
	uitgewerktIn,
	type Grondslag
} from '$lib/text/delegaties';
import { officialNumber } from '$lib/bron/dossier-naam';
import { passageOf, type Row } from './rows';
import { uitsnede, type Passage } from './passage';
import { confidenceWord } from './filter';
import { votesSentence } from '$lib/components/parliamentary/stemming';

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
		textOf(meta.basis_kind) === 'mentioned'
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
		const aard = textOf(meta.procedure_type)?.toLowerCase() ?? 'hoger beroep';
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
	// A motie is `MADE_IN` the debate it was submitted in (`reason` `ingediend`), a stenogram
	// the debate it records.
	MADE_IN: ({ van, meta }) =>
		van === 'commitments'
			? ['toegezegd in', 'toegezegd in', 'toezegging in een activiteit']
			: van === 'decisions'
				? ['genomen in', 'genomen in', 'stemming in een activiteit']
				: van === 'documents' && textOf(meta.reason) === 'ingediend'
					? ['ingediend in', 'ingediend in', 'motie ingediend in een debat']
					: van === 'documents'
						? ['verslag van', 'verslag van', 'verslag van een debat']
						: ['gedaan in', 'gedaan in', 'gedaan in een activiteit'],
	MEMBER_OF: () => ['lid van', 'lid', 'lidmaatschap'],
	SERVED_IN: () => ['bewindspersoon in', 'bewindspersoon', 'ambt in een kabinet'],
	// The edge runs from the member to the stuk: read from there, a member diende in. One who
	// signed as minister or for the Kamer, not as Kamerlid, ondertekende.
	AUTHORED: ({ naar, meta }) => {
		if (naar === 'commitments') return ['deed', 'gedaan door', 'toezegging'];
		const functie = textOf(meta.function);
		const capacity = textOf(meta.capacity);
		return capacity && capacity !== 'kamerlid'
			? [
					functie ? `ondertekende als ${functie}` : 'ondertekende',
					'ondertekend door',
					'ondertekening'
				]
			: ['diende in', 'ingediend door', 'indiening'];
	},
	VOTED: ({ meta }) => {
		const keuze = textOf(meta.choice)?.toLowerCase();
		return [
			keuze === 'voor' || keuze === 'tegen' ? `stemde ${keuze}` : 'stemde over',
			'gestemd door',
			'stem'
		];
	},
	// A supplementary budget revises its chapter (Dossier → Dossier); an amended motion or
	// amendment replaces the one it names (Document → Document, `rule` vervanging).
	REVISES: ({ van, meta }) =>
		van === 'documents' || textOf(meta.rule) === 'vervanging'
			? ['vervangt', 'vervangt', 'vervanging van een motie of amendement']
			: textOf(meta.rule) === 'slotwet'
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
	const [actief, terug, soort] = WOORDEN[changeByEffect(relation, m)]({
		van: van ?? null,
		naar: naar ?? null,
		meta: m
	});
	return { actief, terug, soort };
}

/**
 * Per change, the word that heads an article's line under Gewijzigde artikelen; a bill does
 * not enact an article on its own.
 */
export const CHANGE_HEAD: Record<ChangeRelation, string | null> = {
	ESTABLISHES: null,
	AMENDS: 'Wijziging',
	INTRODUCES: 'Nieuw artikel',
	REPEALS: 'Vervalt'
};

/** A change by its effect on wetten.overheid.nl, where the edge gives one: an AMENDS whose effect is `vervallen` repeals. */
export function changeByEffect(relation: Relation, meta: Record<string, unknown>): Relation {
	const effect = EFFECT[textOf(meta.effect) ?? ''];
	return effect && isChangeRelation(relation) ? effect : relation;
}

/**
 * The verb at the head of a change's line, read from the publication: `Wijzigt`, `Doet
 * vervallen`, of a law `Trekt in`; a renumbering `Vernummert`.
 */
export function changeVerb(
	relation: Relation,
	naar: Collection | null = 'articles',
	meta: Record<string, unknown> = {}
): string {
	if (textOf(meta.effect) === 'vernummering') return 'Vernummert';
	return capitalize(woordenVan(relation, 'instruments', naar, meta).actief);
}

/** A change's verb around what it changes: `stelt 111 artikelen vast`, `trekt de wet in`. */
export function changeAround(relation: ChangeRelation, naar: Collection, object: string): string {
	const [verb, ...particle] = woordenVan(relation, 'instruments', naar).actief.split(' ');
	return [verb, object, ...particle].join(' ');
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
	/^[A-Z][a-z]/.test(s) && !/^(Tweede|Eerste) Kamer\b/.test(s) ? lowerFirst(s) : s;

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

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const keer = (n: number | null) => (n && n > 1 ? `${n} keer` : null);
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ') || null;
const erbij = (teken: string, s: string | null) => (s ? `${teken}${s}` : null);

/** `Stb.2021-162` and `stb_2021_162` as they are cited: `Stb. 2021, 162`. */
export const publicatie = (s: string | null) =>
	s
		?.replace(
			/^(stb|stcrt|trb)_(\d{4})_(\d+)$/i,
			(_, k: string, j, n) => `${capitalize(k)}.${j}-${n}`
		)
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
	// The note the citation stands in goes with the place: `r.o. 5.7.6 (voetnoot 35)`.
	const inNoot = noot?.label ? `(?:\\s*\\(voetnoot ${escapeRegExp(noot.label)}\\))?` : '';
	const nummer = paragraphNumber(at);
	if (!at || nummer === null) {
		// A note of a Kamerstuk, without an r.o.: `voetnoot 71`.
		if (!noot?.label) return null;
		const m = new RegExp(`voetnoot ${escapeRegExp(noot.label)}(?![\\w.])`).exec(rest);
		// The stuk opens at the note itself: its anchor.
		const anker = noot.id;
		return m ? { text: m[0], at: anker, noot: anker } : null;
	}
	const n = escapeRegExp(nummer);
	const m =
		new RegExp(`(?:r\\.o\\.|onder|§)\\s*${n}(?![\\w.])${inNoot}`).exec(rest) ??
		new RegExp(`(?<=\\s)${n}(?![\\w.])${inNoot}`).exec(rest);
	return m ? { text: m[0], at, noot: noot && m[0].includes('voetnoot') ? noot.id : null } : null;
}

/** Where an edge comes from by its `basis`, where it has no `reason`. */
const HERKOMST_BASIS: Partial<Record<string, string>> = {
	subject: 'Onderwerp van het Kamerstuk',
	text: 'Tekst van de brief',
	footnote: 'Voetnoot in de brief'
};

/**
 * The words of the source that name the bron, where the edge keeps them (`meta.text`, an
 * `ANSWERS` from a letter), with the reference as written marked (`meta.reference`); cut to
 * what a row shows.
 */
function aanhalingUitMeta(meta: Record<string, unknown>): Passage | null {
	const zin = textOf(meta.text);
	if (!zin) return null;
	const ref = textOf(meta.reference);
	const i = ref ? zin.indexOf(ref) : -1;
	if (i >= 0)
		return uitsnede({ before: zin.slice(0, i), mark: ref!, after: zin.slice(i + ref!.length) });
	return uitsnede({ before: '', mark: '', after: zin });
}

/** A paper of a pair as the Kamer cites it: `Brief 32761 nr. 12`, `motie 36764 nr. 28`. */
function paarStuk(kant: unknown, eerste: boolean): string | null {
	if (!kant || typeof kant !== 'object') return null;
	const k = kant as Record<string, unknown>;
	if (!k.paper) return null;
	const soort = textOf(k.kind)?.split(/[\s(]/)[0] ?? null;
	const dossier = textOf(k.dossier_number);
	if (!soort || !dossier) return null;
	const suffix = textOf(k.dossier_suffix);
	const nr = num(k.sequence);
	const woord = eerste ? capitalize(soort) : soort.toLowerCase();
	const nummer = suffix ? `${dossier} ${suffix}` : officialNumber(dossier);
	return `${woord} ${nummer}${nr != null ? ` nr. ${nr}` : ''}`;
}

/**
 * The first pair of papers of a relation between two dossiers (`meta.pairs`, the newest
 * first): a letter that goes into the motion, else the two papers side by side.
 */
export function paarZin(pairs: unknown): string | null {
	if (!Array.isArray(pairs)) return null;
	for (const p of pairs) {
		if (!p || typeof p !== 'object') continue;
		const { from, to } = p as Record<string, unknown>;
		const van = paarStuk(from, true);
		const naar = paarStuk(to, false);
		if (!van || !naar) continue;
		const brief = /^brief\b/i.test(van);
		return `${van} ${brief ? 'gaat in op' : 'verbonden met'} ${naar}`;
	}
	return null;
}

/** The selected bron as the object of a line: `Verwijst naar dit artikel`. */
const DIT: Partial<Record<Collection, string>> = {
	articles: 'dit artikel',
	documents: 'dit stuk',
	instruments: 'deze wet',
	judgments: 'deze uitspraak',
	dossiers: 'dit dossier'
};

/** What a relation's line reads: the row, the selected bron and what is read off the edge. */
type HoeContext = {
	row: Row;
	selected: Collection;
	edge: Record<string, unknown>;
	props: Record<string, unknown>;
	/** The collection of the row's bron. */
	other: Collection;
	inbound: boolean;
	/** `lid 3`, where the verbinding names one. */
	lid: string | null;
	/** The place in the citing text: `in r.o. 4.3 en 5.1`, `onder 3`. */
	plaats: string | null;
	citaat: Passage | null;
	/** The provenance of the edge by its `reason`. */
	uitReden: string | null;
	/** Rechtspraak.nl's formal relation, where the edge is one. */
	formeel: string | null;
	/** The words of the relation, read from its source: the row's where it points here. */
	woorden: Woorden | null;
	regel: (werkwoord: string | null, rest: string | null, herkomst: string | null) => Hoe;
};

/**
 * Per relation, its line; `undefined` where the edge says too little for one of its own, and
 * the line falls back to what the group's label leaves out (`hoeVan`).
 */
const HOE: Partial<Record<Relation, (c: HoeContext) => Hoe | null | undefined>> = {
	RELATED_TO: ({ other, selected, edge, regel }) => {
		if (other !== 'dossiers' || selected !== 'dossiers') return undefined;
		const zaken = num(edge.cases);
		// The newest pair of papers the Kamer relates (`meta.pairs`, API 0.79.55): "Brief 32761
		// nr. 12 gaat in op motie 36764 nr. 28".
		const paar = paarZin(edge.pairs);
		if (paar)
			return regel(
				'Door de Kamer verbonden',
				`: ${paar}${zaken && zaken > 1 ? `; ${zaken} zaken` : ''}`,
				'Tweede Kamer, zaak gerelateerd aan zaak'
			);
		const soorten = Array.isArray(edge.case_kinds)
			? edge.case_kinds.filter((k): k is string => typeof k === 'string').join('; ')
			: null;
		return regel(
			'Door de Kamer verbonden',
			erbij(': ', join(zaken ? count(zaken, 'zaak', 'zaken') : null, soorten?.toLowerCase())),
			'Tweede Kamer, zaak gerelateerd aan zaak'
		);
	},
	APPEAL_OF: ({ row, edge, inbound, formeel, regel }) => {
		const aard = row.aard ?? textOf(edge.procedure_type)?.toLowerCase() ?? 'hoger beroep';
		return inbound
			? regel(`${capitalize(aard)} tegen`, 'deze uitspraak', formeel)
			: regel('Bestreden', `in ${aard} met deze uitspraak`, formeel);
	},
	// A regulation under a law or an article, by its kind: `AMvB op grond van art. 3, 16 lid 1
	// en 7` on the law, `AMvB op grond van lid 1 en 7` on the article; one under a regulation
	// under the law, `Ministeriële regeling op grond van art. 19, 23, 28 Cyberbeveiligingsbesluit`
	// (delegaties.ts). Then the articles that work it out.
	BASED_ON: ({ row, selected, edge, props, inbound, uitReden, regel }) => {
		const basis = textOf(edge.basis_kind);
		const grondslag = edge.grondslag as Grondslag | undefined;
		if (!inbound && !grondslag) return undefined;
		const lijn = grondslag
			? grondslagRegel(grondslag)
			: {
					werkwoord: grondslagWerkwoord(textOf(props.kind), basis),
					rest:
						selected === 'instruments'
							? (row.position ?? null)
							: selected === 'articles'
								? (ledenTekst(edge.leden) ?? 'dit artikel')
								: null
				};
		if (!lijn.rest) return undefined;
		return regel(lijn.werkwoord, join(lijn.rest, uitgewerktIn(edge.referring)), uitReden);
	},
	// A memorie's section about the article (`explained-by`, API 0.79.55): its number where the
	// title lacks it and its heading, a link to the section, its opening under it.
	EXPLAINS: ({ row, edge, props, inbound, regel }) => {
		const kop = textOf(edge.heading);
		if (!inbound || !kop || !row.position || !row.at) return undefined;
		const nr = num(props.sequence);
		const nummer = nr != null && !row.title.includes(`nr. ${nr}`) ? `nr. ${nr}` : null;
		const opening = textOf(edge.excerpt);
		return {
			...regel(null, join(nummer, row.position), null),
			citaat: opening ? { before: '', mark: '', after: opening } : null,
			plaats: { text: row.position, at: row.at, noot: null }
		};
	},
	ADVISES_ON: ({ inbound, formeel, regel }) =>
		inbound
			? regel('Conclusie bij', 'deze uitspraak', formeel)
			: regel('Uitspraak op', 'deze conclusie', formeel),
	ESTABLISHES: (c) => wijziging(c),
	AMENDS: (c) => wijziging(c),
	INTRODUCES: (c) => wijziging(c),
	REPEALS: (c) => wijziging(c),
	LEGISLATED_IN: ({ edge, inbound, regel }) => {
		if (inbound)
			return regel(
				'Tot stand gekomen',
				'in dit dossier',
				textOf(edge.dossier_number) ? 'Dossiernummer in de publicatie' : null
			);
		// The dossiers of a wet: the bill that made it, or a bill whose publication amended it
		// (`via`, /api/instruments/{bwb}/dossiers). What the dossier is to the wet, in the Kamer's
		// words; its kind and number stand under it ("Kamerstuk 36764").
		const pub = publicatie(textOf(edge.publication));
		return textOf(edge.via) === 'amending_publication'
			? regel('Wijzigt', join('deze wet', pub), null)
			: regel('Wetsvoorstel', 'van deze wet', null);
	},
	// A letter of the government and the motion it answers: `Gaat in op`, read from the letter.
	// The subject, line or footnote that names the motion (`meta.text`) stands under it with the
	// reference as written marked (`meta.reference`); where it was read (`meta.basis`) is its
	// provenance. A prejudiciële beslissing and a letter that fulfils a toezegging say it in
	// their group's label.
	ANSWERS: ({ other, selected, edge, inbound, regel }) => {
		if (other !== 'documents' || selected !== 'documents') return undefined;
		return regel(
			inbound ? 'Gaat in op' : 'Deze brief gaat erop in',
			inbound ? 'dit stuk' : null,
			HERKOMST_BASIS[textOf(edge.basis) ?? ''] ?? null
		);
	},
	REFERS_TO: verwijzing,
	// A fractie's vote on the decision: `Tegen, 7 zetels`.
	VOTED: ({ edge, inbound, regel }) => {
		const keuze = textOf(edge.choice);
		if (!keuze || !inbound) return undefined;
		const zetels = num(edge.seats);
		return regel(
			capitalize(keuze.toLowerCase()),
			zetels ? `, ${count(zetels, 'zetel', 'zetels')}` : null,
			null
		);
	},
	// What the Tractatenblad publishes of the treaty, as the Verdragenbank writes it.
	PUBLISHED_IN: ({ edge, regel }) => {
		const wat = textOf(edge.description);
		return wat ? regel(null, wat, 'Verdragenbank') : undefined;
	},
	ABOUT: ({ other, props, regel }) => {
		if (other !== 'decisions') return undefined;
		const besluit =
			textOf(props.decision_text)?.replace(/\.$/, '') ??
			(props.passed === true ? 'Aangenomen' : props.passed === false ? 'Verworpen' : null);
		if (!besluit) return undefined;
		const stemmen = votesSentence(props.tally, ' en ');
		return regel(besluit, stemmen && `, ${stemmen}`, 'Besluit van de Kamer');
	}
};

/** A change of the law: its verb, the lid, the day it took effect, the publication. */
function wijziging({ row, selected, edge, other, inbound, lid, regel }: HoeContext): Hoe | null {
	const relation = row.relation!;
	const effect = textOf(edge.effect);
	// The publication that enacted a law, among those that change it (`/amended-by`,
	// `establishes`): `Stelt vast`, its day in the meta line.
	const vastgesteld = changeByEffect(relation, edge) === 'ESTABLISHES';
	const werkwoord = changeVerb(relation, inbound ? selected : other, edge);
	if (vastgesteld && num(edge.establishes)) return regel(werkwoord, null, null);
	// A row from the legislative history carries its change in its own meta line.
	if (!effect && !textOf(edge.effective_date) && !textOf(edge.source_publication)) return null;
	const datum = textOf(edge.effective_date);
	const pub = publicatie(textOf(edge.source_publication));
	const wat = join(
		lid,
		datum ? `in werking ${langeDatum(datum)}` : row.proposed ? 'voorgesteld' : null
	);
	return regel(
		werkwoord,
		// The article it changes, where it is the selected one: `Wijzigt dit artikel, in werking
		// …`; else the row names it, and the rest follows a comma. A separable verb takes no
		// object after it: `Stelt vast, in werking …`.
		inbound && !vastgesteld
			? join(`dit ${selected === 'articles' ? 'artikel' : 'onderdeel'}`, wat)
			: erbij(', ', wat),
		pub ? `Wetten.overheid.nl, ${pub}` : row.proposed ? 'Voorstel van wet' : null
	);
}

/** A reference: between two laws by their articles, an article's by its aard, a citation. */
function verwijzing(c: HoeContext): Hoe {
	const { row, selected, edge, inbound, lid, plaats, citaat, uitReden, woorden, regel } = c;
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
		const dit = textOf(edge.dit) ?? 'deze wet';
		const artikelen = (n: number) => count(n, 'artikel', 'artikelen');
		const verwijzen = (n: number) => plural(n, 'verwijst', 'verwijzen');
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
	// An article of the law and the article it refers to, by its aard: `Verwijst naar art.
	// 6:214 BW, als voorwaarde`.
	const doel = textOf(edge.doel);
	if (doel) return regel('Verwijst naar', join(doel, aard), uitReden);
	const vaak = keer(num(edge.mention_count) ?? (row.mentions?.length || null));
	// The words of the source, where they are not the passage under the line.
	const eigen = !citaat && textOf(edge.text) ? `‘${textOf(edge.text)}’` : null;
	const herkomst =
		uitReden ??
		HERKOMST_BASIS[textOf(edge.basis) ?? ''] ??
		(textOf(edge.cited_ecli)
			? HERKOMST_REDEN.ecli
			: row.snippet || row.match
				? 'Herkend in de tekst'
				: null);
	// A verb with an object names it before the rest: `Verwijst naar lid 2`, `Verwijst naar dit
	// artikel als ‘…’`, `Verwijst ernaar als ‘…’`, never `Verwijst naar als`. A participle needs
	// none: `Aangehaald in r.o. 6`, `Aangehaald onder 3`.
	const woord = capitalize(inbound ? woorden!.actief : woorden!.terug);
	const deelwoord = /^(Aangehaald|Genoemd|Besproken)$/.test(woord);
	const zonderLid = !lid && !deelwoord && !!(eigen || aard);
	const werkwoord = zonderLid && !inbound ? woord.replace(/ naar$/, ' ernaar') : woord;
	const object = lid ?? (zonderLid && inbound ? (DIT[selected] ?? null) : null);
	const kern = join(object, plaats, vaak, aard);
	return regel(
		werkwoord,
		eigen ? (aard ? `${kern}: ${eigen}` : [kern, `als ${eigen}`].filter(Boolean).join(' ')) : kern,
		herkomst
	);
}

/**
 * The line of a row: what the verbinding between the selected bron (`selected`, its
 * collection) and the row's bron is. Null where the group's label says all (a Kamerstuk in
 * its dossier, a lid of a fractie) and the edge adds nothing.
 */
export function hoeVan(row: Row, selected: Collection): Hoe | null {
	const edge = row.edge ?? {};
	const other = row.ref.collection;
	const inbound = row.direction === 'inbound';
	// Derived, or below high confidence: as the filter Betrouwbaarheid grades it.
	const afgeleid = confidenceWord(row.confidence, !!row.derived) !== 'hoog';
	const p = passageOf(row);
	const citaat = p?.mark ? uitsnede(p) : row.relation === 'ANSWERS' ? aanhalingUitMeta(edge) : null;
	const lid = row.lid ? `lid ${row.lid}` : null;
	const plaats = row.position && row.position !== lid ? atPlace(row.position) : null;
	const reden = textOf(edge.reason);
	const uitReden = reden ? (HERKOMST_REDEN[reden] ?? null) : null;
	const regel = (werkwoord: string | null, rest: string | null, herkomst: string | null): Hoe => ({
		werkwoord,
		rest,
		afgeleid,
		citaat,
		plaats: citaat ? plaatsIn(rest, row.passageAt, row.noot ?? null) : null,
		herkomst
	});
	const woorden = row.relation
		? woordenVan(row.relation, inbound ? other : selected, inbound ? selected : other, edge)
		: null;
	const eigen = row.relation
		? HOE[row.relation]?.({
				row,
				selected,
				edge,
				props: (row.props ?? {}) as Record<string, unknown>,
				other,
				inbound,
				lid,
				plaats,
				citaat,
				uitReden,
				formeel:
					textOf(edge.basis) === 'formal_relation' ? 'Rechtspraak.nl, formele relatie' : null,
				woorden,
				regel
			})
		: undefined;
	if (eigen !== undefined) return eigen;
	// The group's label names it (a Kamerstuk in its dossier, a lid in a fractie): only what
	// the edge adds, else nothing.
	if (afgeleid || citaat || lid || plaats) {
		const label = woorden ? (inbound ? woorden.actief : woorden.terug) : null;
		return regel(label ? capitalize(label) : null, join(lid, plaats), uitReden);
	}
	return null;
}
