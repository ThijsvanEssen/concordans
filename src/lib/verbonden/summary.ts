// Verbonden at a glance (besluit 32, mockups V1): per soort of bron a heading with its count
// over the whole, as the API counts it, and the three to read first, each a title and one
// line. The groups of the panel (groups.ts) are its parts: "Alle N" opens the soort with
// them, its order and its filters. Pure: the panel and the network draw from it alike, so
// the heading's count and the legend's total are one sum.
import { KERN } from '$lib/bron/behoort';
import { refId } from '$lib/bron/href';
import { korteDatum } from '$lib/text/datum';
import { ownKind, shortKind } from '$lib/text/document-kind';
import { formatCount } from '$lib/text/getal';
import { lowerFirst, plural } from '$lib/text/words';
import type { Bucket } from '$lib/api/nodes';
import { BRON_LABEL, type Collection } from '$lib/vocabulary';
import { groupCount, type Group } from './groups';
import { byImportance } from './importance';
import type { Row } from './rows';

export type KindId =
	| 'judgments'
	| 'documents'
	| 'laws'
	| 'dossiers'
	| 'decisions'
	| 'activities'
	| 'commitments'
	| 'cases'
	| 'members'
	| 'factions'
	| 'committees'
	| 'cabinets';

const KIND_OF: Partial<Record<Collection, KindId>> = {
	judgments: 'judgments',
	documents: 'documents',
	articles: 'laws',
	instruments: 'laws',
	annexes: 'laws',
	dossiers: 'dossiers',
	decisions: 'decisions',
	activities: 'activities',
	commitments: 'commitments',
	cases: 'cases',
	members: 'members',
	factions: 'factions',
	committees: 'committees',
	cabinets: 'cabinets'
};

/**
 * What a soort is called, as a heading and as the plural of "Alle N …": read from BRON_LABEL,
 * the one list of names. Only the laws differ (a soort of wetten and artikelen); a Kamerzaak
 * keeps its capital.
 */
export const SOORT_LABEL = Object.fromEntries(
	(Object.entries(KIND_OF) as [Collection, KindId][]).map(([collection, id]) => {
		const [one, many] = BRON_LABEL[collection];
		return id === 'laws'
			? [id, { label: 'Wetten', one: 'wet of artikel', many: 'wetten en artikelen' }]
			: [
					id,
					{
						label: many,
						one: collection === 'cases' ? one : lowerFirst(one),
						many: lowerFirst(many)
					}
				];
	})
) as Record<KindId, { label: string; one: string; many: string }>;

/** What the persons of a bron are: its Leden in a fractie or commissie, its Bewindspersonen in a kabinet. */
function membersLabel(selection: Collection): { label: string; one: string; many: string } {
	if (selection === 'factions' || selection === 'committees')
		return { label: 'Leden', one: 'lid', many: 'leden' };
	if (selection === 'cabinets')
		return { label: 'Bewindspersonen', one: 'bewindspersoon', many: 'bewindspersonen' };
	return SOORT_LABEL.members;
}

/** The order of the soorten: the mockups of the article, the dossier and the Kamerlid. */
const ORDER: KindId[] = [
	'judgments',
	'documents',
	'laws',
	'dossiers',
	'decisions',
	'activities',
	'commitments',
	'cases',
	'members',
	'factions',
	'committees',
	'cabinets'
];
const ORDER_OF: Partial<Record<Collection, KindId[]>> = {
	dossiers: ['laws', 'documents', 'decisions', 'activities', 'commitments', 'dossiers'],
	members: ['documents', 'dossiers', 'decisions', 'commitments', 'laws'],
	factions: ['members', 'documents', 'dossiers', 'decisions', 'laws']
};

/** Collections of a bucket that are no soort of their own here: a version of the bron. */
const NOT_COUNTED: ReadonlySet<string> = new Set(['article_versions', 'instrument_versions']);

export type Kind = {
	id: KindId;
	label: string;
	/** Over the whole, as the API counts it. */
	count: number;
	/** "Alle 132 Kamerstukken", "1 uitspraak". */
	noun: string;
	/** Its rows, the most important first: the panel shows three, the network all. */
	rows: Row[];
	/** The groups of the panel it holds. */
	groups: Group[];
	/** Its rows are not all there are. */
	partial: boolean;
	/** A group of it whose rows did not come: said in its place, with Opnieuw. */
	failed: { error: unknown; noun: string | null } | null;
	/** The collection most of its rows are of, for the network's colour. */
	collection: Collection | null;
};

/** The collection of a group: of its rows, else of what it matches or the buckets it reads. */
function collectionOfGroup(g: Group): Collection | null {
	const fromMatch = g.match?.[0]?.collection;
	const c =
		g.rows[0]?.ref.collection ??
		(Array.isArray(fromMatch) ? fromMatch[0] : fromMatch) ??
		g.bakken?.[0]?.collection ??
		null;
	return (c as Collection | null) ?? null;
}

export const kindOfGroup = (g: Group): KindId | null => {
	const c = collectionOfGroup(g);
	return c ? (KIND_OF[c] ?? null) : null;
};

const asList = <T>(v: T | readonly T[]): readonly T[] => (Array.isArray(v) ? v : [v as T]);

/** Whether a bucket (`relation/collection/direction`) is one of `buckets`. */
function inBuckets(key: string, buckets: readonly Bucket[]): boolean {
	const [relation, collection, direction] = key.split('/');
	return buckets.some(
		(b) =>
			(asList(b.relation) as readonly string[]).includes(relation) &&
			(asList(b.collection) as readonly string[]).includes(collection) &&
			(!b.direction || b.direction === direction)
	);
}

/** The rows of a soort in the order to read them, each bron once. */
function kindRows(groups: readonly Group[], kind: KindId, selection: Collection): Row[] {
	const seen = new Set<string>();
	const rows = groups
		.flatMap((g) => g.rows)
		.filter((r) => {
			const id = refId(r.ref);
			if (seen.has(id)) return false;
			seen.add(id);
			return true;
		});
	// One group whose order the API or the panel already set (the judgments of an article by
	// how often they are cited) keeps it; several are merged by the rule of their soort.
	if (groups.length === 1) return rows;
	if (kind === 'judgments' || kind === 'laws') return byImportance(rows, 'cited');
	if (kind === 'documents')
		return byImportance(
			rows,
			selection === 'members' || selection === 'factions' ? 'newest' : 'papers'
		);
	return byImportance(rows, 'newest');
}

/**
 * The soorten of a bron: its groups (kern and inhoud already left out) by the soort of their
 * rows, each counted over the whole. The count is the larger of what the groups count and
 * what the API counts in the buckets of that collection, leaving out the buckets of the kern
 * and of groups the reader shows (`hidden`): a group may hold part of a bucket (a lid's
 * stukken by capacity), a loader may count more than a bucket holds (the wetten of a dossier).
 */
export function kindsOf(
	groups: readonly Group[],
	selection: Collection,
	buckets: ReadonlyMap<string, number> | null | undefined,
	hidden: readonly Group[] = []
): Kind[] {
	const byKind = new Map<KindId, Group[]>();
	for (const g of groups) {
		const k = kindOfGroup(g);
		if (!k || (g.rows.length === 0 && !g.total && !g.laden && !g.failed)) continue;
		byKind.set(k, [...(byKind.get(k) ?? []), g]);
	}
	const kern = KERN[selection] ?? [];
	const hiddenBuckets = hidden.flatMap((g) => g.match ?? []);
	const counted = [...(buckets ?? [])].filter(
		([key]) =>
			!NOT_COUNTED.has(key.split('/')[1]) && !inBuckets(key, kern) && !inBuckets(key, hiddenBuckets)
	);
	const order = ORDER_OF[selection] ?? ORDER;
	const ranked = [...order, ...ORDER.filter((k) => !order.includes(k))];
	return ranked.flatMap((id): Kind[] => {
		const gs = byKind.get(id);
		if (!gs) return [];
		const fromGroups = gs.reduce((sum, g) => sum + groupCount(g), 0);
		const fromBuckets = counted
			.filter(([key]) => KIND_OF[key.split('/')[1] as Collection] === id)
			.reduce((sum, [, n]) => sum + n, 0);
		const count = Math.max(fromGroups, fromBuckets);
		const rows = kindRows(gs, id, selection);
		const failed = gs.find((g) => g.failed && g.rows.length === 0);
		if (count === 0 && rows.length === 0 && !failed) return [];
		const label = id === 'members' ? membersLabel(selection) : SOORT_LABEL[id];
		const allArticles = id === 'laws' && rows.every((r) => r.ref.collection === 'articles');
		const onlyLaws = id === 'laws' && rows.every((r) => r.ref.collection !== 'articles');
		const noun = allArticles
			? plural(count, 'artikel', 'artikelen')
			: onlyLaws
				? plural(count, 'wet', 'wetten')
				: plural(count, label.one, label.many);
		return [
			{
				id,
				label: label.label,
				count,
				noun,
				rows,
				groups: gs,
				partial: rows.length < count || gs.some((g) => g.capped),
				failed: failed ? { error: failed.error, noun: failed.noun ?? null } : null,
				collection: rows[0]?.ref.collection ?? collectionOfGroup(gs[0])
			}
		];
	});
}

/** The sum of the soorten: the heading of Verbonden and the total of the network's legend. */
export const kindsTotal = (kinds: readonly Kind[]): number =>
	kinds.reduce((sum, k) => sum + k.count, 0);

/**
 * The one line under a row's title in the overview: where and how often a judgment is cited
 * (`r.o. 3.4, 168 keer aangehaald`), a Kamerstuk's kind and day, else what the row says of
 * itself and its day. The passage, the ECLI and the source come when the row is opened.
 */
export function shortLine(row: Row): string {
	const props = (row.props ?? {}) as Record<string, unknown>;
	const cited = typeof props.inbound_citation_count === 'number' ? props.inbound_citation_count : 0;
	const day = row.date ? korteDatum(row.date) : null;
	const parts: (string | null)[] =
		row.ref.collection === 'judgments'
			? [row.position ?? null, cited ? `${formatCount(cited)} keer aangehaald` : null]
			: row.ref.collection === 'documents'
				? [titleSays(row.title, props.kind) ? null : ownKind(props.kind), day]
				: row.ref.collection === 'articles'
					? [lawOf(row.title, props) ?? row.context, day]
					: [row.context, day];
	return parts.filter((p): p is string => !!p).join(', ');
}

/** Whether a title names the kind already ("Memorie van toelichting, Kamerstukken II …"). */
const titleSays = (title: string, kind: unknown): boolean =>
	typeof kind === 'string' && title.toLowerCase().startsWith(shortKind(kind).toLowerCase());

/** The law of an article, where its title does not name it: `Burgerlijk Wetboek Boek 5`. */
function lawOf(title: string, props: Record<string, unknown>): string | null {
	const law = props.instrument_citation_title;
	return typeof law === 'string' && law && !title.includes(law) ? law : null;
}
