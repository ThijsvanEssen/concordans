// The groups of the panel Verbonden, per kind of bron. This table is the one definition:
// the panel renders it, and the same groups are the layers of the network.
//
// A group is filled from the node response of the selected bron (`match`: relation,
// direction, collection) or, where no edge says it, by a named loader (`load`).
import { bucketKey } from '$lib/api/nodes';
import type { Collection, Relation } from '$lib/vocabulary';
import { rowOfNeighbor, type Neighbor, type Row } from './rows';

export type Match = {
	relation: Relation | Relation[];
	direction?: 'inbound' | 'outbound';
	collection: Collection | Collection[];
	where?: (n: Neighbor) => boolean;
};

export type Loader =
	| 'dossier-laws'
	| 'dossier-committees'
	| 'dossier-documents-tk'
	| 'dossier-documents-ek'
	| 'dossier-international'
	| 'article-explanatory'
	| 'article-judgments'
	| 'instrument-international'
	| 'judgment-articles'
	| 'instrument-dossiers'
	| 'instrument-amended-by'
	| 'committee-dossiers'
	| 'member-instruments'
	| 'faction-instruments';

export type GroupDef = {
	id: string;
	label: string;
	/** Printed above the first group that carries it: "Tweede Kamer", "Eerste Kamer". */
	section?: string;
	match?: Match[];
	load?: Loader;
	/** A row opens beside the selected bron instead of replacing it. */
	inPlace?: boolean;
};

export type Group = GroupDef & {
	rows: Row[];
	/** The number of bronnen where the API states it; `rows` may hold fewer. */
	total?: number;
	/** The API caps a bucket without saying how many there are: shown as `30+`. */
	capped: boolean;
};

// TODO(backend B9): nothing marks a bron as European or international. Until an
// `eu-links` route exists, the jurisdiction is read from the id: a CELEX number, a
// BWBV (verdrag) id, the ECHR collection.
const INTERNATIONAL_KEY = /^(bwbv\d{7}|[0-9ce]\d{4}[a-z]{1,2}\d{4}|echr_)/i;
export const isInternational = (n: Pick<Neighbor, 'key' | 'props'>): boolean =>
	INTERNATIONAL_KEY.test(n.key) ||
	n.props?.source === 'echr' ||
	n.props?.jurisdiction === 'eu' ||
	n.props?.jurisdiction === 'int';
const national = (n: Neighbor) => !isInternational(n);

const CHANGES: Relation[] = ['AMENDS', 'INTRODUCES', 'REPEALS'];

const EUROPEAN: GroupDef = {
	id: 'international',
	label: 'Europees en internationaal',
	match: [
		{ relation: 'IMPLEMENTS', collection: 'instruments' },
		{
			relation: ['REFERS_TO', 'BASED_ON'],
			collection: ['instruments', 'articles'],
			where: isInternational
		},
		{ relation: 'REFERS_TO', direction: 'inbound', collection: 'judgments', where: isInternational }
	]
};

export const GROUPS: Partial<Record<Collection, GroupDef[]>> = {
	dossiers: [
		{ id: 'laws', label: 'Wetten', load: 'dossier-laws' },
		{ id: 'committees', label: 'Commissie', section: 'Tweede Kamer', load: 'dossier-committees' },
		{
			id: 'documents-tk',
			label: 'Memorie van toelichting en andere stukken',
			section: 'Tweede Kamer',
			load: 'dossier-documents-tk'
		},
		{
			id: 'decisions',
			label: 'Stemmingen',
			section: 'Tweede Kamer',
			match: [{ relation: 'ABOUT', direction: 'inbound', collection: 'decisions' }]
		},
		{
			id: 'commitments',
			label: 'Toezeggingen',
			section: 'Tweede Kamer',
			match: [{ relation: 'ABOUT', direction: 'inbound', collection: 'commitments' }]
		},
		{ id: 'documents-ek', label: 'Stukken', section: 'Eerste Kamer', load: 'dossier-documents-ek' },
		{ ...EUROPEAN, match: undefined, load: 'dossier-international' }
	],
	instruments: [
		{ id: 'dossiers', label: 'Dossiers', load: 'instrument-dossiers' },
		{
			id: 'articles',
			label: 'Artikelen',
			match: [{ relation: 'PART_OF', direction: 'inbound', collection: 'articles' }]
		},
		{
			id: 'implemented-by',
			label: 'Geïmplementeerd door',
			match: [{ relation: 'IMPLEMENTS', direction: 'inbound', collection: 'instruments' }]
		},
		{ ...EUROPEAN, match: undefined, load: 'instrument-international' },
		{ id: 'amended-by', label: 'Wijzigingen', load: 'instrument-amended-by' },
		{
			id: 'judgments',
			label: 'Uitspraken',
			match: [
				{ relation: 'REFERS_TO', direction: 'inbound', collection: 'judgments', where: national }
			]
		}
	],
	articles: [
		{ id: 'explanatory', label: 'Toelichting', load: 'article-explanatory', inPlace: true },
		{ id: 'judgments', label: 'Uitspraken', load: 'article-judgments' },
		{
			id: 'refers-to',
			label: 'Verwijst naar',
			match: [
				{
					relation: ['REFERS_TO', 'BASED_ON'],
					direction: 'outbound',
					collection: ['articles', 'instruments', 'annexes'],
					where: national
				}
			]
		},
		{
			id: 'cited-by',
			label: 'Aangehaald door',
			match: [{ relation: ['REFERS_TO', 'BASED_ON'], direction: 'inbound', collection: 'articles' }]
		},
		{
			id: 'changes',
			label: 'Wijzigingen',
			match: [{ relation: CHANGES, direction: 'inbound', collection: 'documents' }]
		},
		{
			id: 'law',
			label: 'Wet',
			match: [{ relation: 'PART_OF', direction: 'outbound', collection: 'instruments' }]
		},
		EUROPEAN
	],
	judgments: [
		{ id: 'articles', label: 'Aangehaalde artikelen', load: 'judgment-articles' },
		{
			id: 'appeal',
			label: 'Hoger beroep',
			match: [{ relation: 'APPEAL_OF', collection: 'judgments' }]
		},
		{
			id: 'judgments',
			label: 'Aangehaalde uitspraken',
			match: [{ relation: 'REFERS_TO', direction: 'outbound', collection: 'judgments' }]
		},
		{
			id: 'cited-by',
			label: 'Aangehaald door',
			match: [{ relation: 'REFERS_TO', direction: 'inbound', collection: 'judgments' }]
		}
	],
	documents: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'PART_OF', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'explains',
			label: 'Toelichting bij',
			match: [
				{ relation: 'EXPLAINS', direction: 'outbound', collection: ['articles', 'instruments'] }
			]
		},
		{
			id: 'changes',
			label: 'Wijzigt',
			match: [{ relation: CHANGES, direction: 'outbound', collection: ['articles', 'instruments'] }]
		},
		{
			id: 'refers-to',
			label: 'Verwijst naar',
			match: [
				{ relation: 'REFERS_TO', direction: 'outbound', collection: ['articles', 'instruments'] }
			]
		},
		{
			id: 'authors',
			label: 'Indieners',
			match: [{ relation: 'AUTHORED', direction: 'inbound', collection: ['members', 'factions'] }]
		}
	],
	committees: [
		{
			id: 'members',
			label: 'Leden',
			match: [{ relation: 'MEMBER_OF', direction: 'inbound', collection: 'members' }]
		},
		{ id: 'dossiers', label: 'Dossiers', load: 'committee-dossiers' },
		{
			id: 'activities',
			label: 'Activiteiten',
			match: [{ relation: 'LED_BY', direction: 'inbound', collection: 'activities' }]
		}
	],
	members: [
		{
			id: 'factions',
			label: 'Fractie',
			match: [{ relation: 'MEMBER_OF', direction: 'outbound', collection: 'factions' }]
		},
		{
			id: 'committees',
			label: 'Commissies',
			match: [{ relation: 'MEMBER_OF', direction: 'outbound', collection: 'committees' }]
		},
		{
			id: 'authored',
			label: 'Ingediend',
			match: [{ relation: 'AUTHORED', direction: 'outbound', collection: 'documents' }]
		},
		{ id: 'instruments', label: 'Wetten', load: 'member-instruments' }
	],
	factions: [
		{
			id: 'members',
			label: 'Leden',
			match: [{ relation: 'MEMBER_OF', direction: 'inbound', collection: 'members' }]
		},
		{
			id: 'authored',
			label: 'Ingediend',
			match: [{ relation: 'AUTHORED', direction: 'outbound', collection: 'documents' }]
		},
		{ id: 'instruments', label: 'Wetten', load: 'faction-instruments' }
	],
	decisions: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'ABOUT', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'subject',
			label: 'Stuk',
			match: [
				{
					relation: ['ABOUT', 'MADE_IN'],
					direction: 'outbound',
					collection: ['documents', 'cases', 'activities']
				}
			]
		},
		{
			id: 'votes',
			label: 'Fracties',
			match: [{ relation: 'VOTED', direction: 'inbound', collection: 'factions' }]
		}
	],
	activities: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'ABOUT', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'committee',
			label: 'Commissie',
			match: [{ relation: 'LED_BY', direction: 'outbound', collection: 'committees' }]
		},
		{
			id: 'decisions',
			label: 'Stemmingen',
			match: [{ relation: 'MADE_IN', direction: 'inbound', collection: 'decisions' }]
		},
		{
			id: 'cases',
			label: 'Zaken',
			match: [{ relation: 'ABOUT', direction: 'outbound', collection: 'cases' }]
		}
	],
	commitments: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'ABOUT', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'activity',
			label: 'Gedaan in',
			match: [{ relation: 'MADE_IN', direction: 'outbound', collection: 'activities' }]
		}
	],
	cases: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'PART_OF', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'documents',
			label: 'Stukken',
			match: [{ relation: 'PART_OF', direction: 'inbound', collection: 'documents' }]
		},
		{
			id: 'decisions',
			label: 'Stemmingen',
			match: [{ relation: 'ABOUT', direction: 'inbound', collection: 'decisions' }]
		}
	]
};

/** The API's cap per relation and collection; a bucket of this size may be cut off. */
const BUCKET_CAP = 30;
const CAPS: Partial<Record<Collection, Partial<Record<Relation, number>>>> = {
	factions: { VOTED: 20, MEMBER_OF: 50 },
	members: { VOTED: 20, MEMBER_OF: 5 },
	decisions: { VOTED: 50 }
};

const among = <T>(one: T | T[], value: unknown) =>
	Array.isArray(one) ? one.includes(value as T) : one === value;

const matches = (m: Match, n: Neighbor) =>
	among(m.relation, n.relation) &&
	among(m.collection, n.collection) &&
	(!m.direction || m.direction === n.direction) &&
	(!m.where || m.where(n));

/**
 * The groups of a bron that its node response fills, in the order of the table. Groups
 * with a loader come back empty, for the caller to fill. A neighbour lands in the first
 * group that matches it.
 */
export function buildGroups(
	collection: Collection,
	neighbors: Neighbor[],
	/** Per bucket (`relation/collection/direction`), what the database holds; see `bucketTotals`. */
	totals: Map<string, number> = new Map()
): Group[] {
	const defs = GROUPS[collection] ?? [];
	const groups = defs.map<Group>((def) => ({ ...def, rows: [], capped: false }));
	const counted = new Map<string, number>();
	for (const n of neighbors) {
		const bucket = bucketKey(n.relation, n.collection, n.direction);
		counted.set(bucket, (counted.get(bucket) ?? 0) + 1);
	}
	const seen = new Set<string>();
	const summed = new Set<string>();
	for (const n of neighbors) {
		const group = groups.find((g) => g.match?.some((m) => matches(m, n)));
		const row = group && !seen.has(n.id) ? rowOfNeighbor(n) : null;
		if (!group || !row) continue;
		seen.add(n.id);
		group.rows.push(row);
		const bucket = bucketKey(n.relation, n.collection, n.direction);
		const total = totals.get(bucket);
		if (total != null) {
			// A bucket counts for its group once; a `where` may leave some of it out.
			if (!summed.has(`${group.id}:${bucket}`)) {
				summed.add(`${group.id}:${bucket}`);
				group.total = (group.total ?? 0) + total;
			}
		} else {
			// TODO(backend B12): an API before 0.5 caps a bucket without a total.
			const cap = CAPS[collection]?.[n.relation as Relation] ?? BUCKET_CAP;
			if ((counted.get(bucket) ?? 0) >= cap) group.capped = true;
		}
	}
	for (const g of groups) if (g.total != null && g.total < g.rows.length) g.total = g.rows.length;
	return groups;
}

/** `12`, or `30+` for a group the API cut off. */
export const countLabel = (group: Pick<Group, 'rows' | 'capped' | 'total'>) =>
	group.total != null && group.total >= group.rows.length
		? String(group.total)
		: `${group.rows.length}${group.capped ? '+' : ''}`;
