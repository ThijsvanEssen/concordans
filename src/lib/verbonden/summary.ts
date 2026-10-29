// Verbonden at a glance (besluit 32, mockups V1): per soort of bron a heading with its count
// over the whole, as the API counts it, and the three to read first, each a title and one
// line. The groups of the panel (groups.ts) are its parts: "Alle N" opens the soort with
// them, its order and its filters. Pure: the panel and the network draw from it alike, so
// the heading's count and the legend's total are one sum.
import { DISCUSSED_IN_DEBATE, onAgendaOnly } from '$lib/text/toezegging';
import { KERN } from '$lib/bron/behoort';
import { refId } from '$lib/bron/href';
import { korteDatum } from '$lib/text/datum';
import { ownKind, shortKind } from '$lib/text/document-kind';
import { kindName } from '$lib/text/law-kind';
import { formatCount } from '$lib/text/getal';
import { plural } from '$lib/text/words';
import type { Bucket } from '$lib/api/nodes';
import type { Collection } from '$lib/vocabulary';
import {
	sortsFrom,
	isMinister,
	rubriekOfSort,
	sortLabel,
	sortOf,
	sortOne,
	type Sort
} from '$lib/bron/rubrieken';
import { bucketsRead, groupCount, type Group } from './groups';
import { byImportance } from './importance';
import { referenceLine } from './hoe';
import type { Row } from './rows';

type KindId =
	| 'judgments'
	| 'documents'
	| 'regelingen'
	| 'laws'
	| 'lawArticles'
	| 'europees'
	| 'publicaties'
	| 'dossiers'
	| 'decisions'
	| 'activities'
	| 'commitments'
	| 'cases'
	| 'members'
	| 'factions'
	| 'committees'
	| 'cabinets'
	| 'ministries'
	| 'ministers';

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
	cabinets: 'cabinets',
	ministries: 'ministries'
};

/** The soort (indeling.ts) of each kind of Verbonden: its name, its rubriek and its order. */
const SORT_OF_KIND: Record<KindId, Sort> = {
	laws: 'wetten',
	['regelingen']: 'wetten',
	lawArticles: 'artikelen',
	europees: 'internationaal',
	publicaties: 'publicaties',
	judgments: 'uitspraken',
	dossiers: 'dossiers',
	documents: 'stukken',
	decisions: 'stemmingen',
	activities: 'activiteiten',
	commitments: 'toezeggingen',
	cases: 'kamerzaken',
	members: 'kamerleden',
	factions: 'fracties',
	committees: 'commissies',
	cabinets: 'kabinetten',
	ministries: 'ministeries',
	ministers: 'bewindspersonen'
};

/** The kind of Verbonden a soort is: the inverse of SORT_OF_KIND (the regulations are a verband). */
const KIND_OF_SORT = Object.fromEntries(
	(Object.entries(SORT_OF_KIND) as [KindId, Sort][])
		.filter(([id]) => id !== 'regelingen')
		.map(([id, sort]) => [sort, id])
) as Record<Sort, KindId>;

/**
 * The regulations whose Gelet op names the bron (group `based-on`) are a soort of their own,
 * before the laws it cites or is cited by: an AMvB that follows from a law is not a law that
 * names it (Thijs, 23 Oct).
 */
const REGULATIONS: KindId = 'regelingen';

/** What a soort is called, as a heading and as the plural of "Alle N …": the name of its soort. */
export const SOORT_LABEL: Record<KindId, { label: string; one: string; many: string }> =
	Object.fromEntries(
		(Object.entries(SORT_OF_KIND) as [KindId, Sort][]).map(([id, sort]) => [
			id,
			id === 'regelingen'
				? {
						label: 'Uitvoeringsregelingen',
						one: 'uitvoeringsregeling',
						many: 'uitvoeringsregelingen'
					}
				: {
						label: sortLabel(sort),
						one: sortOne(sort),
						many:
							sort === 'internationaal'
								? 'Europese en internationale bronnen'
								: sortLabel(sort).toLowerCase()
					}
		])
	) as Record<KindId, { label: string; one: string; many: string }>;

/** What the persons of a bron are: its Leden in a fractie or commissie, its Bewindspersonen in a kabinet. */
function membersLabel(selection: Collection): { label: string; one: string; many: string } {
	if (selection === 'factions' || selection === 'committees')
		return { label: 'Leden', one: 'lid', many: 'leden' };
	if (selection === 'cabinets')
		return { label: 'Bewindspersonen', one: 'bewindspersoon', many: 'bewindspersonen' };
	return SOORT_LABEL.members;
}

/**
 * A soort called otherwise on the page of a kind of bron: a commissie's reader counts its leden
 * now ("Leden", "Plaatsvervangers"), Verbonden every lid it has had.
 */
const LABEL_ON: Partial<Record<Collection, Partial<Record<KindId, string>>>> = {
	committees: { members: 'Leden ooit' },
	ministries: { dossiers: 'Openstaande dossiers', commitments: 'Open toezeggingen' }
};

/**
 * The order of the soorten: that of the rubrieken (Wetten, Rechtspraak, Kamerstukken, Parlement,
 * Regering), each with its soorten as rubrieken.ts lists them, the rubriek of the bron itself first.
 * The regulations that follow from the bron stand right before the laws.
 */
const orderOf = (selection: Collection): KindId[] =>
	sortsFrom(rubriekOfSort(SORT_OF_KIND[KIND_OF[selection] ?? 'laws'])).flatMap((sort) =>
		sort === 'wetten' ? [REGULATIONS, KIND_OF_SORT[sort]] : [KIND_OF_SORT[sort]]
	);

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
	/** Every group of it is in: its count is what its rows add up to. */
	settled: boolean;
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
	if (g.id === 'based-on') return REGULATIONS;
	const c = collectionOfGroup(g);
	return c ? (KIND_OF[c] ?? null) : null;
};

const asList = <T>(v: T | readonly T[]): readonly T[] => (Array.isArray(v) ? v : [v as T]);

/** Whether a bucket (`relation/collection/direction`) is one of `buckets`. */
export function inBuckets(key: string, buckets: readonly Bucket[]): boolean {
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
	// The buckets of the regulations issued under the bron count with them, not with the laws.
	const regulationBuckets = bucketsRead(byKind.get(REGULATIONS) ?? []);
	const bucketKind = (key: string): KindId | undefined =>
		inBuckets(key, regulationBuckets as Bucket[])
			? REGULATIONS
			: KIND_OF[key.split('/')[1] as Collection];
	const ranked = orderOf(selection);
	const kinds = ranked.flatMap((id): Kind[] => {
		const gs = byKind.get(id);
		if (!gs) return [];
		const fromGroups = gs.reduce((sum, g) => sum + groupCount(g), 0);
		const fromBuckets = counted
			.filter(([key]) => bucketKind(key) === id)
			.reduce((sum, [, n]) => sum + n, 0);
		// Once its groups are in, a soort counts what they hold: what "Alle" opens (T11: 184
		// counted over a list of 56, the law's own articles and every edge to an act of the EU
		// in the buckets). Until then the buckets stand for it, unless its groups list only what is
		// open: the buckets count the finished ones too (A195: 249 counted, 39 lopend).
		const settled = !gs.some((g) => g.laden || g.failed);
		const openOnly = gs.every((g) => g.countsOpenOnly);
		const count = settled || openOnly ? fromGroups : Math.max(fromGroups, fromBuckets);
		// A regulation issued under another stands right under it; the overview names the
		// regulations themselves (KindSummary), the opened soort all of them (T11: 13 counted, 7 shown).
		const rows = kindRows(gs, id, selection);
		const failed = gs.find((g) => g.failed && g.rows.length === 0);
		if (count === 0 && rows.length === 0 && !failed) return [];
		const label = id === 'members' ? membersLabel(selection) : SOORT_LABEL[id];
		const noun = plural(count, label.one, label.many);
		return [
			{
				id,
				label: LABEL_ON[selection]?.[id] ?? label.label,
				count,
				noun,
				rows,
				groups: gs,
				partial: rows.length < count || gs.some((g) => g.capped),
				settled,
				failed: failed ? { error: failed.error, noun: failed.noun ?? null } : null,
				collection: rows[0]?.ref.collection ?? collectionOfGroup(gs[0])
			}
		];
	});
	const split = kinds.flatMap((k) =>
		k.id === 'laws' ? splitLaws(k) : k.id === 'members' ? splitMembers(k, selection) : [k]
	);
	return ranked.flatMap((id) => split.filter((k) => k.id === id));
}

/** The soort of the laws a row is: an article, an act of the EU or a treaty, a publication
 *  of the Staatsblad or Staatscourant, else a law or a regulation. */
const lawClass = (row: Row): KindId => lawClassOf(row.ref.collection, row.ref.key, row.props);

function lawClassOf(c: string, key: string, props: Record<string, unknown> | undefined): KindId {
	const kind = KIND_OF_SORT[sortOf(c, key, props)];
	return kind === 'lawArticles' || kind === 'europees' || kind === 'publicaties' ? kind : 'laws';
}

/**
 * The soort of one bron, as Verbonden would list it: by its collection, the laws by what they
 * are (Artikelen, Europees en internationaal, Publicaties). The legend of the werkplek names a
 * bron Verbonden does not list (one step further, a soort Verbonden has no group for) by it.
 */
export function kindOfBron(
	collection: string,
	key: string,
	props?: Record<string, unknown>
): KindId | null {
	const k = KIND_OF[collection as Collection];
	if (k === 'laws') return lawClassOf(collection, key, props);
	if (k === 'members') return isMinister(props) ? 'ministers' : 'members';
	return k ?? null;
}

/** What a soort is called on the page of `selection`: as its heading in Verbonden. */
export function kindLabelOn(id: KindId, selection: Collection): string {
	return (
		LABEL_ON[selection]?.[id] ??
		(id === 'members' ? membersLabel(selection) : SOORT_LABEL[id]).label
	);
}

/** The soort a group of laws holds mostly: its own (Europees en internationaal, the
 *  publications that amend), else that of most of its rows. */
function groupClass(g: Group): KindId {
	if (g.id === 'international') return 'europees';
	if (g.id === 'amended-by') return 'publicaties';
	const tally = new Map<KindId, number>();
	for (const r of g.rows) tally.set(lawClass(r), (tally.get(lawClass(r)) ?? 0) + 1);
	return [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'laws';
}

/**
 * The soort Wetten in its soorten (T11): Wetten en regelingen, Artikelen, Europees en
 * internationaal, Publicaties. Each counts its rows; what a group holds beyond its rows
 * counts with the soort it holds mostly. An act of the EU it implements comes first, then
 * the newest; the others keep the order of their importance.
 */
function splitLaws(k: Kind): Kind[] {
	const byClass = new Map<KindId, Row[]>();
	for (const r of k.rows) byClass.set(lawClass(r), [...(byClass.get(lawClass(r)) ?? []), r]);
	const rest = new Map<KindId, number>();
	for (const g of k.groups) {
		const more = Math.max(0, groupCount(g) - g.rows.length);
		if (more) rest.set(groupClass(g), (rest.get(groupClass(g)) ?? 0) + more);
	}
	// What the buckets count beyond the groups stays with the laws.
	const loaded = k.groups.reduce((sum, g) => sum + groupCount(g), 0);
	const beyond = Math.max(0, k.count - Math.max(loaded, k.rows.length));
	if (beyond) rest.set('laws', (rest.get('laws') ?? 0) + beyond);
	const ids: KindId[] = ['laws', 'lawArticles', 'europees', 'publicaties'];
	return ids.flatMap((id): Kind[] => {
		const rows0 = byClass.get(id) ?? [];
		const count = rows0.length + (rest.get(id) ?? 0);
		if (count === 0) return [];
		const rows =
			id === 'europees'
				? [...rows0].sort(
						(a, b) =>
							Number(b.relation === 'IMPLEMENTS') - Number(a.relation === 'IMPLEMENTS') ||
							(b.date ?? '').localeCompare(a.date ?? '')
					)
				: id === 'publicaties'
					? [...rows0].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
					: rows0;
		const label = SOORT_LABEL[id];
		const groups = k.groups.filter(
			(g) => groupClass(g) === id || g.rows.some((r) => lawClass(r) === id)
		);
		return [
			{
				...k,
				id,
				label: label.label,
				count,
				noun: plural(count, label.one, label.many),
				rows,
				groups,
				partial: rows.length < count || groups.some((g) => g.capped),
				settled: k.settled,
				collection: rows[0]?.ref.collection ?? k.collection
			}
		];
	});
}

/**
 * The persons of a bron by their role (Kamerlid in Parlement, bewindspersoon in Regering): on a
 * kabinet or a ministerie they are all bewindspersonen, on a fractie or commissie all leden; else
 * each row by its posts (`isMinister`), what the groups hold beyond their rows counting with
 * the Kamerleden.
 */
function splitMembers(k: Kind, selection: Collection): Kind[] {
	const as = (id: 'members' | 'ministers', rows: Row[], count: number): Kind => {
		const label = SOORT_LABEL[id];
		return {
			...k,
			id,
			label: id === 'ministers' ? label.label : k.label,
			count,
			noun: plural(count, label.one, label.many),
			rows,
			partial: rows.length < count || k.groups.some((g) => g.capped)
		};
	};
	if (selection === 'cabinets' || selection === 'ministries')
		return [as('ministers', k.rows, k.count)];
	if (selection === 'factions' || selection === 'committees') return [k];
	const ministers = k.rows.filter((r) => isMinister(r.props, r.relation));
	if (ministers.length === 0) return [k];
	const others = k.rows.filter((r) => !ministers.includes(r));
	const beyond = Math.max(0, k.count - k.rows.length);
	return [
		...(others.length + beyond > 0 ? [as('members', others, others.length + beyond)] : []),
		as('ministers', ministers, ministers.length)
	];
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
	// An article of this law that refers to another: the target, as the open row says it.
	const refers = referenceLine(row);
	if (refers) return refers;
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
					: row.relation === 'BASED_ON' && row.direction === 'inbound'
						? [kindName(typeof props.kind === 'string' ? props.kind : null), day]
						: [row.context, day];
	// A toezegging only on the agenda of the dossier's debate says so, as its row does (hoe.ts).
	const agenda =
		row.ref.collection === 'commitments' && onAgendaOnly((row.edge ?? {}).basis)
			? DISCUSSED_IN_DEBATE
			: null;
	return [agenda, ...parts].filter((p): p is string => !!p).join(', ');
}

/** Whether a title names the kind already ("Memorie van toelichting, Kamerstukken II …"). */
const titleSays = (title: string, kind: unknown): boolean =>
	typeof kind === 'string' && title.toLowerCase().startsWith(shortKind(kind).toLowerCase());

/** The law of an article, where its title does not name it: `Burgerlijk Wetboek Boek 5`. */
function lawOf(title: string, props: Record<string, unknown>): string | null {
	const law = props.instrument_citation_title;
	return typeof law === 'string' && law && !title.includes(law) ? law : null;
}

type Preview = {
	id: string;
	label: string;
	count: number | null;
	noun?: string;
	section?: string;
	ordered?: boolean;
	kind?: string;
	kindLabel?: string;
};

/**
 * The groups to come as the overview will show them: one head per soort, in the soort's own
 * name, so the head that stands while loading is the head that stays (UX-toets N14a).
 */
export function previewPerKind<T extends Preview>(preview: readonly T[]): T[] {
	const out: T[] = [];
	for (const p of preview) {
		const had = p.kind ? out.find((o) => o.kind === p.kind) : undefined;
		if (!had) {
			out.push({
				...p,
				id: p.kind ? p.kind : p.id,
				label: p.kindLabel ?? p.label,
				section: undefined
			});
			continue;
		}
		had.count = had.count != null && p.count != null ? had.count + p.count : null;
		had.ordered = had.ordered || p.ordered;
	}
	return out;
}
