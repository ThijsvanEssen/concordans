// The names the API defines for nodes and edges (lawgraph docs/data-model.md).
// The schema types them as plain strings, so this is the one place they are listed.

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
	committees: 'committee'
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
	'SCOPED_BY',
	'ABOUT',
	'LED_BY',
	'MADE_IN',
	'MEMBER_OF',
	'AUTHORED',
	'VOTED'
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
