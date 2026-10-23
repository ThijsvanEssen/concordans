// The words of a verbinding, from one source (`relationWords`): per relation, the collections
// at its two ends and what its meta says. The row, the line on the canvas, the line between
// two hulls, the legend, the table, the CSV and the card Verbinding all read them, so one
// verbinding is never called two things (onderzoek samenhang, 14 Oct). Only words: a page that
// names a relation does not load the rows of Verbonden.
import { capitalize, lowerFirst, textOf } from '$lib/text/words';
import { onAgendaOnly, DISCUSSED_IN_DEBATE } from '$lib/text/toezegging';
import { parseOutcome, type TableOutcome, type OutcomeKind } from './edge-meta';
import {
	isChangeRelation,
	type ChangeRelation,
	type Collection,
	type Relation
} from '$lib/vocabulary';

/** The words of one verbinding, by its relation, its two ends and its meta. */
export type RelationWords = {
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
const IN_A: Partial<Record<Collection, string>> = {
	judgments: 'in een uitspraak',
	documents: 'in een Kamerstuk',
	articles: 'in een artikel',
	instruments: 'in een wet',
	dossiers: 'in een dossier'
};

const inA = (noun: string, van: Collection | null) =>
	van && IN_A[van] ? `${noun} ${IN_A[van]}` : noun;

/** Of a change: the article or the law it changes. */
const ofA = (naar: Collection | null) => (naar === 'articles' ? 'van een artikel' : 'van een wet');

/**
 * Per relation, its words. The source collection decides who speaks: a judgment `haalt aan`,
 * an article `verwijst naar`, a Kamerstuk `noemt`.
 */
const WOORDEN: Record<Relation, (e: Ends) => W> = {
	PART_OF: ({ van, naar }) =>
		van === 'documents' && naar === 'dossiers'
			? ['stuk in', 'dossier van', 'stuk in een dossier']
			: van === 'documents'
				? ['stuk bij', 'onderwerp van', 'stuk bij een Kamerzaak']
				: van === 'cases'
					? ['onderdeel van', 'dossier van', 'onderdeel van een dossier']
					: van === 'instruments'
						? ['onderdeel van', 'omvat', 'onderdeel van een verdrag']
						: van === 'annexes'
							? ['bijlage bij', 'wet van', 'bijlage bij een wet']
							: van === 'articles'
								? ['artikel van', 'wet van', 'artikel van een wet']
								: ['onderdeel van', 'omvat', 'onderdeel'],
	VERSION_OF: () => ['versie van', 'versie', 'versie'],
	// The publication that enacted a new regulation set its articles (BWB `nieuwe-regeling`).
	ESTABLISHES: ({ naar }) => ['stelt vast', 'vastgesteld bij', `vaststelling ${ofA(naar)}`],
	AMENDS: ({ naar }) => ['wijzigt', 'wijzigt', `wijziging ${ofA(naar)}`],
	// A publication in the Staatsblad by which a law or its articles come into force.
	COMMENCES: () => ['doet in werking treden', 'in werking getreden bij', 'inwerkingtreding'],
	INTRODUCES: ({ naar }) => ['voegt in', 'voegt in', `invoeging ${ofA(naar)}`],
	// An article vervalt; a law is ingetrokken (Aanwijzingen voor de regelgeving).
	REPEALS: ({ naar }) =>
		naar === 'instruments'
			? ['trekt in', 'trekt in', 'intrekking van een wet']
			: ['doet vervallen', 'doet vervallen', 'vervallen van een artikel'],
	// A recodification: the transposition table places the old article in the new law; to the
	// new law itself, what it says of an old article it places in no article (its outcome).
	TRANSPOSED_TO: ({ naar, meta }) => {
		if (naar !== 'instruments')
			return ['overgebracht naar', 'in het nieuwe recht', 'overbrenging naar het nieuwe recht'];
		const o = parseOutcome(meta.outcome);
		// An article that stays in its law or goes to another one the source names is not
		// brought to the new law.
		const elsewhere = o?.kind === 'blijft_in' || o?.kind === 'naar';
		const word = o && !elsewhere && o.kind !== 'gat' ? OUTCOME_WORD[o.kind] : null;
		const w = word ?? (elsewhere ? 'niet overgebracht naar' : 'zonder opvolger in');
		return [w, w, 'uitkomst in het nieuwe recht'];
	},
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
	LEGISLATED_IN: () => [
		'tot stand gekomen in',
		'tot stand gekomen in',
		'totstandkoming via een wetsvoorstel'
	],
	PUBLISHED_IN: () => ['gepubliceerd in', 'gepubliceerd in', 'publicatie in het Tractatenblad'],
	REFERS_TO: ({ van }) =>
		van === 'judgments'
			? ['haalt aan', 'aangehaald', 'verwijzing in een uitspraak']
			: van === 'documents'
				? ['noemt', 'genoemd', 'verwijzing in een Kamerstuk']
				: van === 'instruments'
					? ['noemt', 'genoemd', 'vermelding in een wet']
					: ['verwijst naar', 'verwijst naar', inA('verwijzing', van)],
	EXPLAINS: ({ naar }) => [
		'licht toe',
		'toegelicht in',
		naar === 'instruments' ? 'toelichting bij een wet' : 'toelichting bij een artikel'
	],
	APPEAL_OF: ({ meta }) => {
		const aard = textOf(meta.procedure_type)?.toLowerCase() ?? 'hoger beroep';
		return [`${aard} tegen`, `bestreden in ${aard}`, aard];
	},
	ADVISES_ON: () => ['conclusie bij', 'uitspraak na', 'conclusie in dezelfde zaak'],
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
						: ['ook gepubliceerd als', 'ook gepubliceerd als', 'andere uitgave'],
	SCOPED_BY: () => ['begrensd door', 'begrenst', 'reikwijdte in een bijlage'],
	// A toezegging is about the dossier of the letter that fulfils it; one on the agenda of its
	// debate only was discussed there (`meta.basis` `agenda`, toezegging.ts).
	ABOUT: ({ van, meta }) =>
		van === 'decisions'
			? ['over', 'onderwerp van', 'onderwerp van een stemming']
			: van === 'commitments' && onAgendaOnly(meta.basis)
				? [
						`${lowerFirst(DISCUSSED_IN_DEBATE)} over`,
						'op de agenda bij',
						'toezegging besproken in een debat over een dossier'
					]
				: van === 'commitments'
					? ['over', 'onderwerp van', 'toezegging in een dossier']
					: ['over', 'onderwerp van', 'onderwerp van een debat of vergadering'],
	LED_BY: () => ['onder leiding van', 'voortouw bij', 'voortouwcommissie'],
	// A motie is `MADE_IN` the debate it was submitted in (`reason` `ingediend`), a stenogram
	// the debate it records.
	MADE_IN: ({ van, meta }) =>
		van === 'commitments'
			? ['toegezegd in', 'toegezegd in', 'toezegging in een debat']
			: van === 'decisions'
				? ['genomen in', 'genomen in', 'stemming in een vergadering']
				: van === 'documents' && textOf(meta.reason) === 'ingediend'
					? ['ingediend in', 'ingediend in', 'motie ingediend in een debat']
					: van === 'documents'
						? ['verslag van', 'verslag van', 'verslag van een debat']
						: ['genoemd in', 'genoemd in', 'vermelding in een debat of vergadering'],
	MEMBER_OF: () => ['lid van', 'lid', 'lidmaatschap'],
	SERVED_IN: () => ['bewindspersoon in', 'bewindspersoon', 'ambt in een kabinet'],
	// The edge runs from the member to the stuk: read from there, a member diende in. One who
	// signed as minister or for the Kamer, not as Kamerlid, ondertekende.
	AUTHORED: ({ naar, meta }) => {
		if (naar === 'commitments') return ['zegde toe', 'toegezegd door', 'toezegging'];
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
			'stemming'
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
						van === 'dossiers'
							? 'door de Kamer verbonden dossiers'
							: 'door de Kamer verbonden Kamerzaken'
					]
				: ['hangt samen met', 'hangt samen met', 'samenhang'],
	SECOND_READING_OF: () => ['tweede lezing van', 'tweede lezing van', 'tweede lezing']
};

/**
 * What a recodification did with an old article, before the law it names: `vervallen bij` and
 * `niet overgenomen in` the new law, `blijft in` the law the source names (`Waterwet`), `naar`
 * the other law it sends the article to (`Gratiewet`).
 */
export const OUTCOME_WORD: Record<Exclude<OutcomeKind, 'gat'>, string> = {
	vervallen: 'vervallen bij',
	niet_overgenomen: 'niet overgenomen in',
	blijft_in: 'blijft in',
	naar: 'naar'
};

/**
 * A part's outcome on its own, where the new law goes without saying: `vervallen`, `niet
 * overgenomen`, `blijft in Waterwet`, `naar Gratiewet`. Null for a part no source places (`gat`).
 */
export function outcomePlace(o: TableOutcome): string | null {
	if (o.kind === 'vervallen') return 'vervallen';
	if (o.kind === 'niet_overgenomen') return 'niet overgenomen';
	if (o.kind === 'blijft_in') return o.law ? `${OUTCOME_WORD.blijft_in} ${o.law}` : 'blijft';
	if (o.kind === 'naar') return `${OUTCOME_WORD.naar} ${o.law}`;
	return null;
}

/**
 * The words of a verbinding: the relation, the collection of its source (`van`) and of its
 * target (`naar`), and its meta where the edge carries one (`procedure_type`, `rule`,
 * `function`, `effect`). Without collections, the words of the relation in general.
 */
export function relationWords(
	relation: Relation,
	van?: Collection | null,
	naar?: Collection | null,
	meta?: Record<string, unknown> | null
): RelationWords {
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
	return capitalize(relationWords(relation, 'instruments', naar, meta).actief);
}

/** A change's verb around what it changes: `stelt 111 artikelen vast`, `trekt de wet in`. */
export function changeAround(relation: ChangeRelation, naar: Collection, object: string): string {
	const [verb, ...particle] = relationWords(relation, 'instruments', naar).actief.split(' ');
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
): string => relationWords(relation, van, naar, meta).actief;

/** What the verbinding is, for the head of the card Verbinding: `verwijzing in een uitspraak`. */
export const soortVan = (
	relation: Relation,
	van?: Collection | null,
	naar?: Collection | null,
	meta?: Record<string, unknown> | null
): string => relationWords(relation, van, naar, meta).soort;
