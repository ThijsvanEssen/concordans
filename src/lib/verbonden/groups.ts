// The groups of the panel Verbonden, per kind of bron. This table is the one definition:
// the panel renders it, the table lists it, and the legend of the network counts it.
// The name of a group states the direction: "Uitspraken die dit artikel aanhalen".
//
// A group is filled from the node response of the selected bron (`match`: relation,
// direction, collection) or, where no edge says it, by a named loader (`load`).
import { bucketKey } from '$lib/api/nodes';
import { isRelation, type Collection, type Relation } from '$lib/vocabulary';
import { formatCount, isInternational } from './filter';
import { rowOfNeighbor, type Neighbor, type Row } from './rows';

export { isInternational };

export type Match = {
	relation: Relation | Relation[];
	direction?: 'inbound' | 'outbound';
	collection: Collection | Collection[];
	where?: (n: Neighbor) => boolean;
	/** The bucket is divided over several groups by `where`: none of them takes its total. */
	split?: boolean;
};

export type Loader =
	| 'dossier-laws'
	| 'dossier-same-number'
	| 'dossier-committees'
	| 'dossier-documents-tk'
	| 'dossier-documents-ek'
	| 'dossier-international'
	| 'article-explanatory'
	| 'article-judgments'
	| 'article-cited-by'
	| 'instrument-international'
	| 'judgment-articles'
	| 'instrument-dossiers'
	| 'instrument-related'
	| 'instrument-aard'
	| 'instrument-amended-by'
	| 'instrument-judgments'
	| 'committee-dossiers'
	| 'committee-activities'
	| 'member-instruments'
	| 'faction-instruments'
	| 'member-dossiers'
	| 'faction-dossiers';

export type GroupDef = {
	id: string;
	label: string;
	/** The bronnen of the group in the plural, for "Alle 1.064 uitspraken". */
	noun?: string;
	/** Printed above the first group that carries it: "Tweede Kamer", "Eerste Kamer". */
	section?: string;
	match?: Match[];
	load?: Loader;
	/** A row opens beside the selected bron instead of replacing it. */
	inPlace?: boolean;
	/** A name that follows the rows shown: the functions a lid signed in. */
	labelOf?: (rows: Row[]) => string;
};

export type Group = GroupDef & {
	rows: Row[];
	/** The number of bronnen where the API states it; `rows` may hold fewer. */
	total?: number;
	/** The places these bronnen name the selected one, where a row bundles several. */
	mentions?: number;
	/** The API caps a bucket without saying how many there are: shown as `30+`. */
	capped: boolean;
};

const national = (n: Neighbor) => !isInternational(n);

// What a lid signed a stuk as (`meta.capacity` of AUTHORED): as Kamerlid, as
// bewindspersoon, or in another function (vicepresident van de Raad van State).
type Capacity = 'kamerlid' | 'bewindspersoon' | 'overig';
const signedAs = (capacity: Capacity) => (n: Neighbor) =>
	(n.meta as Record<string, unknown> | null)?.capacity === capacity;

/** `a`, `a en b`, `a, b en c`; beyond three, `a, b en 2 andere functies`. */
function functionList(rows: Row[]): string {
	const counts = new Map<string, number>();
	for (const r of rows) if (r.function) counts.set(r.function, (counts.get(r.function) ?? 0) + 1);
	const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
	if (names.length > 3)
		return `${names.slice(0, 2).join(', ')} en ${names.length - 2} andere functies`;
	return names.length > 1
		? `${names.slice(0, -1).join(', ')} en ${names.at(-1)}`
		: (names[0] ?? '');
}

const authored = (
	capacity: Capacity,
	label: string,
	labelOf?: (rows: Row[]) => string
): GroupDef => ({
	id: `authored-${capacity}`,
	label,
	noun: 'stukken',
	match: [
		{
			relation: 'AUTHORED',
			direction: 'outbound',
			collection: 'documents',
			where: signedAs(capacity),
			split: true
		}
	],
	labelOf
});

const CHANGES: Relation[] = ['AMENDS', 'INTRODUCES', 'REPEALS'];

const EUROPEAN: GroupDef = {
	id: 'international',
	label: 'Europees en internationaal',
	noun: 'Europese en internationale bronnen',
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
		{ id: 'laws', label: 'Wetten die dit dossier raakt', noun: 'wetten', load: 'dossier-laws' },
		{
			id: 'same-number',
			label: 'Dossiers onder hetzelfde nummer',
			noun: 'dossiers',
			load: 'dossier-same-number'
		},
		// A change in the Grondwet is read twice; the memorie van toelichting is in the
		// dossier of the first reading, the second only refers to it.
		{
			id: 'first-reading',
			label: 'Eerste lezing van deze grondwetsherziening',
			noun: 'dossiers',
			match: [{ relation: 'SECOND_READING_OF', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'second-reading',
			label: 'Tweede lezing van deze grondwetsherziening',
			noun: 'dossiers',
			match: [{ relation: 'SECOND_READING_OF', direction: 'inbound', collection: 'dossiers' }]
		},
		{
			id: 'revises',
			label: 'Begrotingen die dit dossier wijzigt',
			noun: 'dossiers',
			match: [{ relation: 'REVISES', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'revised-by',
			label: 'Dossiers die deze begroting wijzigen',
			noun: 'dossiers',
			match: [{ relation: 'REVISES', direction: 'inbound', collection: 'dossiers' }]
		},
		{
			id: 'accompanies',
			label: 'Nota waarmee dit dossier is ingediend',
			noun: 'dossiers',
			match: [{ relation: 'ACCOMPANIES', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'accompanied-by',
			label: 'Dossiers ingediend met deze nota',
			noun: 'dossiers',
			match: [{ relation: 'ACCOMPANIES', direction: 'inbound', collection: 'dossiers' }]
		},
		{
			id: 'related',
			label: 'Dossiers die de Kamer met dit dossier verbindt',
			noun: 'dossiers',
			match: [{ relation: 'RELATED_TO', collection: 'dossiers' }]
		},
		{
			id: 'committees',
			label: 'Commissie',
			section: 'Tweede Kamer',
			load: 'dossier-committees'
		},
		{
			id: 'documents-tk',
			label: 'Memorie van toelichting en andere stukken',
			noun: 'stukken',
			section: 'Tweede Kamer',
			load: 'dossier-documents-tk'
		},
		{
			id: 'decisions',
			label: 'Stemmingen over dit dossier',
			noun: 'stemmingen',
			section: 'Tweede Kamer',
			match: [{ relation: 'ABOUT', direction: 'inbound', collection: 'decisions' }]
		},
		{
			id: 'commitments',
			label: 'Toezeggingen over dit dossier',
			noun: 'toezeggingen',
			section: 'Tweede Kamer',
			match: [{ relation: 'ABOUT', direction: 'inbound', collection: 'commitments' }]
		},
		{
			id: 'documents-ek',
			label: 'Stukken',
			noun: 'stukken',
			section: 'Eerste Kamer',
			load: 'dossier-documents-ek'
		},
		{ ...EUROPEAN, match: undefined, load: 'dossier-international' }
	],
	instruments: [
		{
			// A publication in the Staatsblad or Staatscourant is an instrument that changes
			// articles; a law has no such edges, so the group shows for publications only.
			id: 'changes',
			label: 'Artikelen die deze publicatie wijzigt',
			noun: 'artikelen',
			match: [{ relation: CHANGES, direction: 'outbound', collection: ['articles', 'instruments'] }]
		},
		{
			id: 'dossiers',
			label: 'Dossiers die deze wet raken',
			noun: 'dossiers',
			load: 'instrument-dossiers'
		},
		{
			id: 'articles',
			label: 'Artikelen van deze wet',
			noun: 'artikelen',
			match: [{ relation: 'PART_OF', direction: 'inbound', collection: 'articles' }]
		},
		{
			id: 'implemented-by',
			label: 'Regelingen die deze wet implementeren',
			noun: 'regelingen',
			match: [{ relation: 'IMPLEMENTS', direction: 'inbound', collection: 'instruments' }]
		},
		{ ...EUROPEAN, match: undefined, load: 'instrument-international' },
		{
			id: 'amended-by',
			label: 'Wetsvoorstellen die deze wet wijzigen',
			noun: 'wetsvoorstellen',
			load: 'instrument-amended-by'
		},
		{
			id: 'aard',
			label: 'Verwijzingen vanuit deze wet, naar aard',
			noun: 'verwijzingen',
			load: 'instrument-aard'
		},
		{
			id: 'related',
			label: 'Wetten die met deze wet verbonden zijn',
			noun: 'wetten',
			load: 'instrument-related'
		},
		{
			id: 'judgments',
			label: 'Uitspraken die deze wet aanhalen',
			noun: 'uitspraken',
			load: 'instrument-judgments'
		}
	],
	articles: [
		{
			id: 'judgments',
			label: 'Uitspraken die dit artikel aanhalen',
			noun: 'uitspraken',
			load: 'article-judgments'
		},
		{
			id: 'cited-by',
			label: 'Artikelen die naar dit artikel verwijzen',
			noun: 'artikelen',
			load: 'article-cited-by'
		},
		{
			id: 'explanatory',
			label: 'Toelichting',
			noun: 'toelichtingen',
			load: 'article-explanatory',
			inPlace: true
		},
		{
			id: 'changes',
			label: 'Wetsvoorstellen die dit artikel wijzigen',
			noun: 'wetsvoorstellen',
			match: [{ relation: CHANGES, direction: 'inbound', collection: 'documents' }]
		},
		{
			id: 'refers-to',
			label: 'Artikelen waarnaar dit artikel verwijst',
			noun: 'artikelen',
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
			id: 'documents',
			label: 'Kamerstukken die dit artikel aanhalen',
			noun: 'Kamerstukken',
			match: [
				{
					relation: 'REFERS_TO',
					direction: 'inbound',
					collection: 'documents',
					where: (n) => !CHANGES.includes(n.relation as Relation)
				}
			]
		},
		{
			id: 'law',
			label: 'Wet',
			match: [{ relation: 'PART_OF', direction: 'outbound', collection: 'instruments' }]
		},
		EUROPEAN
	],
	judgments: [
		{
			id: 'articles',
			label: 'Artikelen die deze uitspraak aanhaalt',
			noun: 'artikelen',
			load: 'judgment-articles'
		},
		{
			id: 'conclusion',
			label: 'Conclusie in dezelfde zaak',
			match: [{ relation: 'ADVISES_ON', direction: 'inbound', collection: 'judgments' }]
		},
		{
			id: 'advised',
			label: 'Uitspraak in dezelfde zaak',
			match: [{ relation: 'ADVISES_ON', direction: 'outbound', collection: 'judgments' }]
		},
		// The row says which remedy: `cassatie` or `hoger beroep`.
		{
			id: 'earlier-instance',
			label: 'Uitspraak in eerdere aanleg',
			match: [{ relation: 'APPEAL_OF', direction: 'outbound', collection: 'judgments' }]
		},
		{
			id: 'later-instance',
			label: 'Hoger beroep of cassatie tegen deze uitspraak',
			match: [{ relation: 'APPEAL_OF', direction: 'inbound', collection: 'judgments' }]
		},
		{
			id: 'judgments',
			label: 'Uitspraken die deze uitspraak aanhaalt',
			noun: 'uitspraken',
			match: [{ relation: 'REFERS_TO', direction: 'outbound', collection: 'judgments' }]
		},
		{
			id: 'cited-by',
			label: 'Uitspraken die deze uitspraak aanhalen',
			noun: 'uitspraken',
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
			label: 'Artikelen die dit stuk toelicht',
			noun: 'artikelen',
			match: [
				{ relation: 'EXPLAINS', direction: 'outbound', collection: ['articles', 'instruments'] }
			]
		},
		{
			id: 'changes',
			label: 'Artikelen die dit stuk wijzigt',
			noun: 'artikelen',
			match: [{ relation: CHANGES, direction: 'outbound', collection: ['articles', 'instruments'] }]
		},
		{
			id: 'refers-to',
			label: 'Artikelen die dit stuk aanhaalt',
			noun: 'artikelen',
			match: [
				{ relation: 'REFERS_TO', direction: 'outbound', collection: ['articles', 'instruments'] }
			]
		},
		{
			id: 'authors',
			label: 'Indieners',
			noun: 'indieners',
			match: [{ relation: 'AUTHORED', direction: 'inbound', collection: ['members', 'factions'] }]
		}
	],
	committees: [
		{
			id: 'members',
			label: 'Leden van deze commissie',
			noun: 'leden',
			match: [{ relation: 'MEMBER_OF', direction: 'inbound', collection: 'members' }]
		},
		{
			id: 'dossiers',
			label: 'Dossiers van deze commissie',
			noun: 'dossiers',
			load: 'committee-dossiers'
		},
		{
			id: 'activities',
			label: 'Activiteiten van deze commissie',
			noun: 'activiteiten',
			load: 'committee-activities'
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
			label: 'Commissies van dit lid',
			noun: 'commissies',
			match: [{ relation: 'MEMBER_OF', direction: 'outbound', collection: 'committees' }]
		},
		// A person signs as what they are at that moment: Kamerlid, bewindspersoon, or
		// in another function. The name follows the functions of the rows shown.
		authored('kamerlid', 'Stukken die dit lid als Kamerlid indiende'),
		authored('bewindspersoon', 'Stukken ondertekend als bewindspersoon', (rows) =>
			rows.length
				? `Stukken ondertekend als ${functionList(rows)}`
				: 'Stukken ondertekend als bewindspersoon'
		),
		authored('overig', 'Stukken ondertekend in een andere functie', (rows) =>
			rows.length
				? `Stukken ondertekend als ${functionList(rows)}`
				: 'Stukken ondertekend in een andere functie'
		),
		{
			id: 'dossiers',
			label: 'Dossiers van dit lid',
			noun: 'dossiers',
			load: 'member-dossiers'
		},
		{
			id: 'instruments',
			label: 'Wetten waaraan dit lid werkte',
			noun: 'wetten',
			load: 'member-instruments'
		}
	],
	factions: [
		{
			id: 'members',
			label: 'Leden van deze fractie',
			noun: 'leden',
			match: [{ relation: 'MEMBER_OF', direction: 'inbound', collection: 'members' }]
		},
		{
			id: 'authored',
			label: 'Stukken die deze fractie indiende',
			noun: 'stukken',
			match: [{ relation: 'AUTHORED', direction: 'outbound', collection: 'documents' }]
		},
		{
			id: 'dossiers',
			label: 'Dossiers van deze fractie',
			noun: 'dossiers',
			load: 'faction-dossiers'
		},
		{
			id: 'instruments',
			label: 'Wetten waaraan deze fractie werkte',
			noun: 'wetten',
			load: 'faction-instruments'
		}
	],
	decisions: [
		{
			id: 'dossier',
			label: 'Dossier',
			match: [{ relation: 'ABOUT', direction: 'outbound', collection: 'dossiers' }]
		},
		{
			id: 'subject',
			label: 'Stuk waarover is gestemd',
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
			label: 'Fracties die stemden',
			noun: 'fracties',
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
			label: 'Stemmingen in deze activiteit',
			noun: 'stemmingen',
			match: [{ relation: 'MADE_IN', direction: 'inbound', collection: 'decisions' }]
		},
		{
			id: 'cases',
			label: 'Zaken',
			noun: 'zaken',
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
			label: 'Activiteit waarin de toezegging is gedaan',
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
			label: 'Stukken van deze zaak',
			noun: 'stukken',
			match: [{ relation: 'PART_OF', direction: 'inbound', collection: 'documents' }]
		},
		{
			id: 'decisions',
			label: 'Stemmingen over deze zaak',
			noun: 'stemmingen',
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
 * group that matches it, also when several relations bring it: the conclusion of the
 * Advocaat-Generaal is an ADVISES_ON and a REFERS_TO neighbour of the judgment, and
 * shows once, as the conclusion.
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
	// Rows a split group took from a bucket that another group takes the total of.
	const claimed = new Map<string, number>();
	// Per group and bucket, the neighbours it counts that an earlier group shows.
	const shownElsewhere = new Map<string, number>();
	const placed = neighbors
		.map((n) => ({ n, at: groups.findIndex((g) => g.match?.some((m) => matches(m, n))) }))
		.filter((p) => p.at >= 0)
		.sort((a, b) => a.at - b.at);
	for (const { n, at } of placed) {
		const group = groups[at];
		const bucket = bucketKey(n.relation, n.collection, n.direction);
		if (seen.has(n.id)) {
			const key = `${group.id}:${bucket}`;
			shownElsewhere.set(key, (shownElsewhere.get(key) ?? 0) + 1);
			continue;
		}
		const row = rowOfNeighbor(n);
		if (!row) continue;
		seen.add(n.id);
		group.rows.push(row);
		const total = totals.get(bucket);
		// A bucket split over several groups states no total for any one of them: each
		// counts its rows, capped while the bucket holds more than was loaded.
		if (total != null && group.match?.some((m) => m.split && matches(m, n))) {
			if ((counted.get(bucket) ?? 0) < total) group.capped = true;
			claimed.set(bucket, (claimed.get(bucket) ?? 0) + 1);
		} else if (total != null) {
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
	for (const key of summed) {
		const [id, bucket] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
		const g = groups.find((x) => x.id === id);
		if (g?.total != null) g.total -= (claimed.get(bucket) ?? 0) + (shownElsewhere.get(key) ?? 0);
	}
	for (const g of groups) {
		if (g.total != null && g.total < g.rows.length) g.total = g.rows.length;
		if (g.labelOf) g.label = g.labelOf(g.rows);
	}
	// A relation the API gained before this list did: shown, not dropped without a word.
	const other: Group = { id: 'other', label: 'Andere verbindingen', rows: [], capped: false };
	for (const n of neighbors) {
		if (isRelation(n.relation) || seen.has(n.id)) continue;
		const row = rowOfNeighbor(n);
		if (!row) continue;
		seen.add(n.id);
		other.rows.push(row);
	}
	return other.rows.length ? [...groups, other] : groups;
}

/** The number of bronnen of a group: what the API states, else what is loaded. */
export const groupCount = (group: Pick<Group, 'rows' | 'total'>) =>
	group.total != null && group.total >= group.rows.length ? group.total : group.rows.length;

/** `12`, `1.064`, or `30+` for a group the API cut off. */
export const countLabel = (group: Pick<Group, 'rows' | 'capped' | 'total'>) =>
	group.total != null && group.total >= group.rows.length
		? formatCount(group.total)
		: `${formatCount(group.rows.length)}${group.capped ? '+' : ''}`;
