// The names the API defines for nodes and edges (lawgraph docs/data-model.md), typed by the
// generated schema: a collection or relation the API adds or drops fails the typecheck here.
import type { Schema } from '$lib/api/types';

/** The collection of a node: the first half of its id. */
export type Collection = Schema<'BaseNodeDTO'>['collection'];

/** The relation of an edge. */
export type Relation = NonNullable<Schema<'NodeNeighborhoodEdge'>['relation']>;

/** Collection to node type. */
export const NODE_TYPES = {
	instruments: 'instrument',
	instrument_versions: 'instrument_version',
	articles: 'article',
	article_versions: 'article_version',
	annexes: 'annex',
	judgments: 'judgment',
	dossiers: 'dossier',
	cases: 'case',
	documents: 'document',
	activities: 'activity',
	decisions: 'decision',
	commitments: 'commitment',
	members: 'member',
	factions: 'faction',
	committees: 'committee',
	cabinets: 'cabinet'
} as const satisfies Record<Collection, string>;

/** Every relation once, in the order of the API's catalogue; the record makes the type complete. */
const RELATION_SET: Record<Relation, true> = {
	PART_OF: true,
	VERSION_OF: true,
	ESTABLISHES: true,
	AMENDS: true,
	INTRODUCES: true,
	REPEALS: true,
	TRANSPOSED_TO: true,
	BASED_ON: true,
	IMPLEMENTS: true,
	LEGISLATED_IN: true,
	PUBLISHED_IN: true,
	REFERS_TO: true,
	EXPLAINS: true,
	APPEAL_OF: true,
	CONTINUES: true,
	REFERRED_BY: true,
	ADVISES_ON: true,
	ANSWERS: true,
	SAME_AS: true,
	SCOPED_BY: true,
	ABOUT: true,
	LED_BY: true,
	MADE_IN: true,
	MEMBER_OF: true,
	SERVED_IN: true,
	AUTHORED: true,
	RELATED_TO: true,
	REVISES: true,
	ACCOMPANIES: true,
	SECOND_READING_OF: true,
	VOTED: true
};

export const RELATIONS = Object.keys(RELATION_SET) as readonly Relation[];

/** The changes of the law, in the order a line names them: enacts, amends, inserts, repeals. */
export const CHANGE_RELATIONS = [
	'ESTABLISHES',
	'AMENDS',
	'INTRODUCES',
	'REPEALS'
] as const satisfies readonly Relation[];

export type ChangeRelation = (typeof CHANGE_RELATIONS)[number];

/**
 * The changes of a law that exists: what a bill proposes and an amending publication makes.
 * ESTABLISHES is a publication enacting a regulation: no bill proposes it, and it is enacted
 * by what it is.
 */
export const AMENDING_RELATIONS = [
	'AMENDS',
	'INTRODUCES',
	'REPEALS'
] as const satisfies readonly ChangeRelation[];

export const isChangeRelation = (value: string | null | undefined): value is ChangeRelation =>
	(CHANGE_RELATIONS as readonly (string | null | undefined)[]).includes(value);

export const isAmendingRelation = (
	value: string | null | undefined
): value is (typeof AMENDING_RELATIONS)[number] =>
	(AMENDING_RELATIONS as readonly (string | null | undefined)[]).includes(value);

/** A change as the API writes it, `amends`, as its relation. */
export const changeRelation = <E extends Lowercase<ChangeRelation>>(effect: E) =>
	effect.toUpperCase() as Uppercase<E>;

/** The same for a code the API may give for something else (`legislated_in`): null then. */
export const changeRelationOf = (code: string | null | undefined): ChangeRelation | null => {
	const relation = code?.toUpperCase();
	return isChangeRelation(relation) ? relation : null;
};

/**
 * What a recodification did with an old article no new article takes the place of: an edge
 * TRANSPOSED_TO the new law, with its outcome in `meta` (vervallen, niet overgenomen, blijft
 * in, or not found). No verbinding between two bronnen: the head of the old article says it,
 * the canvas and the new law do not draw it (a law has some 1.300 of them).
 */
export const isTranspositionOutcome = (
	relation: string | null | undefined,
	target: string | null | undefined
): boolean => relation === 'TRANSPOSED_TO' && target === 'instruments';

export const isCollection = (value: string | null | undefined): value is Collection =>
	value != null && Object.hasOwn(NODE_TYPES, value);

export const isRelation = (value: string | null | undefined): value is Relation =>
	value != null && Object.hasOwn(RELATION_SET, value);

/** A node id: `collection/key`. */
type NodeId = `${Collection}/${string}`;

/** The id of a node; of a known collection it is a NodeId. */
export function nodeId(collection: Collection, key: string): NodeId;
export function nodeId(collection: string, key: string): string;
export function nodeId(collection: string, key: string): string {
	return `${collection}/${key}`;
}

export function parseNodeId(id: string): { collection: Collection; key: string } | null {
	const slash = id.indexOf('/');
	const collection = id.slice(0, slash);
	const key = id.slice(slash + 1);
	return slash > 0 && key && isCollection(collection) ? { collection, key } : null;
}

/** What a bron of each collection is called, singular and plural. The one list of labels. */
export const BRON_LABEL: Record<Collection, readonly [singular: string, plural: string]> = {
	instruments: ['Wet', 'Wetten'],
	instrument_versions: ['Versie', 'Versies'],
	articles: ['Artikel', 'Artikelen'],
	article_versions: ['Artikelversie', 'Artikelversies'],
	annexes: ['Bijlage', 'Bijlagen'],
	judgments: ['Uitspraak', 'Uitspraken'],
	dossiers: ['Dossier', 'Dossiers'],
	cases: ['Zaak', 'Zaken'],
	documents: ['Stuk', 'Stukken'],
	activities: ['Activiteit', 'Activiteiten'],
	decisions: ['Stemming', 'Stemmingen'],
	commitments: ['Toezegging', 'Toezeggingen'],
	members: ['Kamerlid', 'Kamerleden'],
	factions: ['Fractie', 'Fracties'],
	committees: ['Commissie', 'Commissies'],
	cabinets: ['Kabinet', 'Kabinetten']
};

export const bronLabel = (collection: Collection) => BRON_LABEL[collection][0];
export const bronPlural = (collection: Collection) => BRON_LABEL[collection][1];

/** A Dutch regeling of any kind, as a legend names its square and its articles' hull. */
export const REGULATION_LABEL = 'Wet of regeling';

// What a verbinding is called (`haalt aan`, `bijlage bij`) has one source: $lib/verbonden/relation-words.ts.

/** The college of a judgment, as the API names it (`tier`): its Type in the Rechtspraak's list of Instanties. */
export type Tier = Schema<'Tier'>;

/**
 * What each college is called, in the order the filters list them: the highest courts,
 * the courts of fact, the tuchtcolleges and other colleges, the courts of the Caribbean
 * part of the Kingdom, the Kroon and the courts abroad. Typed against the API, so a new
 * college does not go unnamed.
 */
export const TIER_LABEL: Record<Tier, string> = {
	hoge_raad: 'Hoge Raad',
	parket: 'Parket bij de Hoge Raad',
	raad_van_state: 'Raad van State',
	centrale_raad_van_beroep: 'Centrale Raad van Beroep',
	college_van_beroep_bedrijfsleven: 'College van Beroep voor het bedrijfsleven',
	gerechtshof: 'Gerechtshoven',
	rechtbank: 'Rechtbanken',
	kantongerecht: 'Kantongerechten',
	tuchtcollege: 'Tuchtcolleges',
	andere_instantie: 'Andere colleges',
	koninkrijksinstantie: 'Gerechten in het Caribisch deel',
	kroon: 'Kroon',
	buitenlandse_instantie: 'Buitenlandse instanties',
	hvj_eu: 'Hof van Justitie EU',
	ehrm: 'EHRM'
};

export const TIERS = Object.keys(TIER_LABEL) as Tier[];

/** The court within a tier (`court_kind`); in a tier of one kind, the tier itself. */
export type CourtKind = Schema<'CourtKind'>;

export const COURT_KIND_LABEL: Record<CourtKind, string> = {
	hoge_raad: 'Hoge Raad',
	parket: 'Parket bij de Hoge Raad',
	raad_van_state: 'Raad van State',
	centrale_raad_van_beroep: 'Centrale Raad van Beroep',
	college_van_beroep_bedrijfsleven: 'College van Beroep voor het bedrijfsleven',
	gerechtshof: 'Gerechtshoven',
	rechtbank: 'Rechtbanken',
	kantongerecht: 'Kantongerechten',
	tuchtcollege: 'Tuchtcolleges',
	ambtenarengerecht: 'Ambtenarengerechten',
	college_van_beroep_studiefinanciering: 'College van Beroep Studiefinanciering',
	college_van_beroep_voor_het_hoger_onderwijs: 'College van Beroep voor het hoger onderwijs',
	raad_van_arbitrage_in_bouwgeschillen: 'Raad van Arbitrage voor de Bouw',
	raad_van_beroep: 'Raden van Beroep',
	raad_voor_strafrechtstoepassing_en_jeugdbescherming:
		'Raad voor Strafrechtstoepassing en Jeugdbescherming',
	tariefcommissie: 'Tariefcommissie',
	constitutioneel_hof: 'Constitutioneel Hof Sint Maarten',
	gemeenschappelijk_hof_van_justitie: 'Gemeenschappelijk Hof van Justitie',
	gerecht_in_ambtenarenzaken: 'Gerecht in Ambtenarenzaken',
	gerecht_in_eerste_aanleg: 'Gerechten in eerste aanleg',
	hof_van_justitie: 'Hof van Justitie van de Nederlandse Antillen',
	raad_van_beroep_in_ambtenarenzaken: 'Raad van Beroep in Ambtenarenzaken',
	raad_van_beroep_voor_belastingzaken: 'Raad van Beroep voor Belastingzaken',
	kroon: 'Kroon',
	buitenlandse_instantie: 'Buitenlandse instanties',
	hvj_eu: 'Hof van Justitie EU',
	ehrm: 'EHRM'
};

export const COURT_KINDS = Object.keys(COURT_KIND_LABEL) as CourtKind[];

/** The status of a verbinding as the API writes it, and as the screen prints it. */
export const statusLabel = (status: string | null | undefined) =>
	status === 'voorgesteld' ? 'voorgesteld' : 'vastgesteld';

/** The three ways to look at the material: Lezen, Netwerk and Bronnen. */
export type Mode = 'read' | 'graph' | 'index';

// ── The kind of a bron ────────────────────────────────────────────────────

// TODO(backend B9): nothing marks a bron as European or international. Until an
// `eu-links` route exists, the jurisdiction is read from the id: a CELEX number, a
// BWBV (verdrag) id, an ECLI of the EHRM or of a court of the EU.
const INTERNATIONAL_KEY = /^(bwbv\d{7}|[0-9ce]\d{4}[a-z]{1,2}\d{4}|ecli_ce_echr_|ecli_eu_)/i;

/** The sources of the European courts: the EHRM (HUDOC) and the courts of the EU (EUR-Lex). */
export const EUROPEAN_SOURCES = ['echr', 'cjeu'] as const;
export type EuropeanSource = (typeof EUROPEAN_SOURCES)[number];

export const isInternational = (n: {
	key: string;
	props?: Record<string, unknown> | null;
}): boolean =>
	INTERNATIONAL_KEY.test(n.key) ||
	EUROPEAN_SOURCES.includes(n.props?.source as EuropeanSource) ||
	n.props?.jurisdiction === 'eu' ||
	n.props?.jurisdiction === 'int';

/** A document that proposes or enacts a change: a wetsvoorstel or an amendment to it. */
export const BILL_KIND = /\b(voorstel van wet|wetsvoorstel|nota van wijziging|amendement)\b/i;
