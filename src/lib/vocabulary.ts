// The names the API defines for nodes and edges (lawgraph docs/data-model.md).
// The schema types them as plain strings, so this is the one place they are listed.
import type { Schema } from '$lib/api/types';

/** Collection (the first half of a node id) to node type. */
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
} as const;

export type Collection = keyof typeof NODE_TYPES;
export type NodeType = (typeof NODE_TYPES)[Collection];

export const RELATIONS = [
	'PART_OF',
	'VERSION_OF',
	'AMENDS',
	'INTRODUCES',
	'REPEALS',
	'BASED_ON',
	'IMPLEMENTS',
	'LEGISLATED_IN',
	'REFERS_TO',
	'EXPLAINS',
	'APPEAL_OF',
	'ADVISES_ON',
	'SCOPED_BY',
	'ABOUT',
	'LED_BY',
	'MADE_IN',
	'MEMBER_OF',
	'AUTHORED',
	'VOTED',
	'REVISES',
	'ACCOMPANIES',
	'RELATED_TO',
	'SECOND_READING_OF',
	'SERVED_IN'
] as const;

export type Relation = (typeof RELATIONS)[number];

const relations: ReadonlySet<string> = new Set(RELATIONS);

export const isCollection = (value: string | null | undefined): value is Collection =>
	value != null && Object.hasOwn(NODE_TYPES, value);

export const isRelation = (value: string | null | undefined): value is Relation =>
	value != null && relations.has(value);

/** A node id: `collection/key`. */
export type NodeId = `${Collection}/${string}`;

export const nodeId = (collection: Collection, key: string): NodeId => `${collection}/${key}`;

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

/** What a verbinding is called, as a verb in the third person, read from its source. */
export const RELATION_LABEL: Record<Relation, string> = {
	PART_OF: 'onderdeel van',
	VERSION_OF: 'versie van',
	AMENDS: 'wijzigt',
	INTRODUCES: 'voegt toe',
	REPEALS: 'trekt in',
	BASED_ON: 'gebaseerd op',
	IMPLEMENTS: 'implementeert',
	LEGISLATED_IN: 'vastgesteld in',
	REFERS_TO: 'verwijst naar',
	EXPLAINS: 'licht toe',
	APPEAL_OF: 'hoger beroep van',
	ADVISES_ON: 'conclusie bij',
	SCOPED_BY: 'begrensd door',
	ABOUT: 'over',
	LED_BY: 'geleid door',
	MADE_IN: 'gedaan in',
	MEMBER_OF: 'lid van',
	AUTHORED: 'ingediend door',
	VOTED: 'stemde over',
	REVISES: 'wijzigt de begroting',
	ACCOMPANIES: 'ingediend met',
	RELATED_TO: 'verbonden met',
	SECOND_READING_OF: 'tweede lezing van',
	SERVED_IN: 'bewindspersoon in'
};

/**
 * The label of a verbinding. A reference from a judgment or a parliamentary document
 * is a citation ("haalt aan"); between two articles it is a reference in the text of
 * the law ("verwijst naar").
 */
export const relationLabel = (relation: Relation, sourceCollection?: Collection | null) =>
	relation === 'REFERS_TO' && sourceCollection && sourceCollection !== 'articles'
		? 'haalt aan'
		: RELATION_LABEL[relation];

/** The college of a judgment, as the API names it (`tier`). */
export type Tier = Schema<'Tier'>;

/**
 * What each college is called, in the order the filters list them: the highest courts,
 * the other appeal courts, the lower courts, the colleges of the Caribbean part of the
 * Kingdom and the rest, the European courts last. Typed against the API, so a new college
 * does not go unnamed.
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
	ambtenarengerecht: 'Ambtenarengerechten',
	college_van_beroep_hoger_onderwijs: 'College van Beroep voor het hoger onderwijs',
	college_van_beroep_studiefinanciering: 'College van Beroep Studiefinanciering',
	raad_van_beroep: 'Raden van Beroep',
	raad_van_beroep_in_ambtenarenzaken: 'Raad van Beroep in Ambtenarenzaken',
	raad_van_beroep_voor_belastingzaken: 'Raad van Beroep voor Belastingzaken',
	raad_voor_strafrechtstoepassing_en_jeugdbescherming:
		'Raad voor Strafrechtstoepassing en Jeugdbescherming',
	raad_van_arbitrage_in_bouwgeschillen: 'Raad van Arbitrage voor de Bouw',
	tariefcommissie: 'Tariefcommissie',
	gemeenschappelijk_hof: 'Gemeenschappelijk Hof van Justitie',
	constitutioneel_hof: 'Constitutioneel Hof Sint Maarten',
	gerecht_in_eerste_aanleg: 'Gerechten in eerste aanleg',
	gerecht_in_ambtenarenzaken: 'Gerecht in Ambtenarenzaken',
	kroon: 'Kroon',
	buitenlandse_instantie: 'Buitenlandse instanties',
	hvj_eu: 'Hof van Justitie EU',
	ehrm: 'EHRM'
};

export const TIERS = Object.keys(TIER_LABEL) as Tier[];

/** The status of a verbinding as the API writes it, and as the screen prints it. */
export const statusLabel = (status: string | null | undefined) =>
	status === 'voorgesteld' ? 'voorgesteld' : 'vastgesteld';

/** The three ways to look at the material, in the order of the keys 1, 2 and 3. */
export const MODES = [
	{ id: 'read', label: 'Lezen' },
	{ id: 'graph', label: 'Netwerk' },
	{ id: 'index', label: 'Bladeren' }
] as const;

export type Mode = (typeof MODES)[number]['id'];

export const isMode = (value: string | null | undefined): value is Mode =>
	MODES.some((m) => m.id === value);
