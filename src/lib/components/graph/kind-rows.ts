// Soort of the werkplek's legend around one bron (N1): the soorten of Verbonden, with its words
// and its counts (view.ts `panelKinds`), each saying how many of them the canvas draws:
// "9 van 29". Before them what the bron holds itself, which its reader shows and Verbonden
// leaves out (a law's articles, a fractie's leden); after them what the canvas draws that
// Verbonden does not list, in Verbonden's words, of the API's whole where it cut it off.
import { refId } from '$lib/bron/href';
import { isInhoudGroep, isKernGroep } from '$lib/bron/behoort';
import { FILTER_GROUP_LABEL, filterGroupOf, type FilterGroup } from '$lib/verbonden/filter';
import { formatCount } from '$lib/text/getal';
import { groupCount, type Group } from '$lib/verbonden/groups';
import { kindLabelOn, kindOfBron, type Kind } from '$lib/verbonden/summary';
import type { Collection } from '$lib/vocabulary';
import { motionOrAmendment } from '$lib/text/document-kind';

/** A bron the canvas draws, a cluster's members each. */
export type DrawnBron = {
	id: string;
	collection: Collection;
	key: string;
	props?: Record<string, unknown>;
	filterGroup: FilterGroup;
	/** Tied to the bron itself; else one step further (Aantal stappen 2). */
	direct?: boolean;
};

export type KindRow = {
	id: string;
	label: string;
	/** How many the canvas draws. */
	drawn: number;
	/** The whole, as Verbonden counts it (or the API, for a soort Verbonden has not). */
	total: number | null;
	/** The kinds of the bronfilter its switch switches. */
	filterGroups: FilterGroup[];
	/** The collection of its bronnen: its glyph and colour. */
	collection: Collection | null;
	/** The collection "Alle laden" asks in full, where the API cut it off. */
	load: Collection | null;
	/** Bronnen one step further: not Verbonden's, under a heading of their own. */
	further?: boolean;
};

/** What a group of the bron's own content is called in the legend, where not by its label. */
const OWN_LABEL: Partial<Record<Collection, Partial<Record<string, string>>>> = {
	// A fractie's leden of every period, as a commissie's in Verbonden (N13).
	factions: { members: 'Leden ooit' }
};

/** The bronnen the band of a bron names beside its kern groups (`lazeKernIds`). */
const CHAIN_LABEL: Partial<Record<Collection, string>> = {
	judgments: 'Procesgang',
	dossiers: 'Wetten die het voorstel wijzigt'
};

type Bucket = { collection: string; total: number; kept: number };

/**
 * What a bron's reader shows itself beside Verbonden, by what a drawn bron is: a dossier's
 * votes on amendments stand with its Amendementen, Verbonden lists its motions (loaders.ts).
 */
const OWN_KIND: Partial<
	Record<Collection, { id: string; label: string; is: (b: DrawnBron) => boolean }>
> = {
	dossiers: {
		id: 'eigen:amendementen',
		label: 'Stemmingen over amendementen',
		is: (b) => b.collection === 'decisions' && motionOrAmendment(b.props?.kind) === 'amendement'
	}
};

/** Whether a bron is the bron's own content: a law's own articles, a fractie's leden. */
function inContents(focus: { collection: Collection; key: string }, g: Group, b: DrawnBron) {
	if (g.rows.some((r) => refId(r.ref) === b.id)) return true;
	if (b.collection !== g.id) return false;
	// A law's articles carry its key: `BWBR0005416_146`. Another law's that cite it do not.
	return (
		focus.collection !== 'instruments' ||
		b.key.toLowerCase().startsWith(`${focus.key.toLowerCase()}_`)
	);
}

const collectionOf = (rows: readonly { ref: { collection: string } }[]) =>
	(rows[0]?.ref.collection as Collection | undefined) ?? null;

/** The row of the bron's own content a drawn bron belongs to, if any. */
function ownRow(
	focus: { collection: Collection; key: string },
	kern: readonly Group[],
	contents: readonly Group[],
	chain: ReadonlySet<string>,
	b: DrawnBron
): string | null {
	const kernGroup = kern.find((g) => g.rows.some((r) => refId(r.ref) === b.id));
	if (kernGroup) return `eigen:${kernGroup.id}`;
	if (chain.has(b.id)) return 'eigen:keten';
	const kind = OWN_KIND[focus.collection];
	if (kind?.is(b)) return kind.id;
	const g = contents.find((g) => inContents(focus, g, b));
	return g ? `eigen:${g.id}` : null;
}

/**
 * The rows of Soort around `focus`. Every drawn bron counts once: in its own content, else in
 * the soort of Verbonden that lists it, else in the soort it is of.
 */
export function kindRows(o: {
	focus: { collection: Collection; key: string };
	kinds: readonly Kind[];
	/** Every group of Verbonden, its kern and its own content too. */
	groups: readonly Group[];
	chain?: ReadonlySet<string>;
	drawn: readonly DrawnBron[];
	buckets?: readonly Bucket[];
}): KindRow[] {
	const { focus, kinds, drawn } = o;
	const chain = o.chain ?? new Set<string>();
	const buckets = o.buckets ?? [];
	const kern = o.groups.filter((g) => isKernGroep(focus.collection, g));
	const contents = o.groups.filter((g) => isInhoudGroep(focus.collection, g));
	const rowIds = new Map(kinds.map((k) => [k.id, new Set(k.rows.map((r) => refId(r.ref)))]));
	const kindIds = new Set<string>(kinds.map((k) => k.id));

	const drawnBy = new Map<string, DrawnBron[]>();
	const add = (makeRow: string, b: DrawnBron) =>
		drawnBy.set(makeRow, [...(drawnBy.get(makeRow) ?? []), b]);
	const rest = new Map<string, { label: string; collection: Collection }>();
	const toRest = (id: string, label: string, b: DrawnBron) => {
		add(id, b);
		if (!rest.has(id)) rest.set(id, { label, collection: b.collection });
	};
	// What Verbonden does not list by name, but its soort counts: in it, up to its count.
	const perKind = new Map<string, DrawnBron[]>();
	for (const b of drawn) {
		const own = ownRow(focus, kern, contents, chain, b);
		if (b.direct === false && !own) {
			const kind = kindOfBron(b.collection, b.key, b.props);
			toRest(
				`verder:${kind ?? b.filterGroup}`,
				kind ? kindLabelOn(kind, focus.collection) : FILTER_GROUP_LABEL[b.filterGroup],
				b
			);
			continue;
		}
		const listed = kinds.find((k) => rowIds.get(k.id)?.has(b.id))?.id;
		const kind = listed ?? kindOfBron(b.collection, b.key, b.props);
		if (own) add(own, b);
		else if (listed) add(listed, b);
		else if (kind && kindIds.has(kind)) perKind.set(kind, [...(perKind.get(kind) ?? []), b]);
		else
			toRest(
				`canvas:${kind ?? b.filterGroup}`,
				kind ? kindLabelOn(kind, focus.collection) : FILTER_GROUP_LABEL[b.filterGroup],
				b
			);
	}
	// What Verbonden does not count of a soort stands in that soort too: no row of leftovers.
	for (const k of kinds) for (const b of perKind.get(k.id) ?? []) add(k.id, b);

	const filterGroupsOf = (
		rows: readonly { filterGroup: FilterGroup }[],
		fallback: Collection | null
	) => {
		const set = new Set<FilterGroup>(rows.map((r) => r.filterGroup));
		if (set.size === 0 && fallback) set.add(filterGroupOf(fallback, '', {}));
		return [...set];
	};
	const makeRow = (
		id: string,
		label: string,
		total: number | null,
		rows: readonly { filterGroup: FilterGroup }[],
		collection: Collection | null
	): KindRow => {
		const d = drawnBy.get(id) ?? [];
		return {
			id,
			label,
			drawn: d.length,
			total: total != null && total > d.length ? total : null,
			filterGroups: filterGroupsOf([...rows, ...d], collection),
			collection: collection ?? d[0]?.collection ?? null,
			load: null
		};
	};

	const rows: KindRow[] = [
		...[...kern, ...contents].flatMap((g) => {
			const id = `eigen:${g.id}`;
			if (!drawnBy.has(id)) return [];
			const label = OWN_LABEL[focus.collection]?.[g.id] ?? g.label;
			return [makeRow(id, label, groupCount(g), g.rows, collectionOf(g.rows))];
		}),
		...[OWN_KIND[focus.collection]].flatMap((e) =>
			e && drawnBy.has(e.id) ? [makeRow(e.id, e.label, null, [], null)] : []
		),
		...(drawnBy.has('eigen:keten')
			? [makeRow('eigen:keten', CHAIN_LABEL[focus.collection] ?? 'Behoort bij', null, [], null)]
			: []),
		// Never more drawn than Verbonden counts: the legend and Verbonden say one number.
		...kinds.map((k) => {
			const row = makeRow(k.id, k.label, k.count, k.rows, k.collection);
			return { ...row, drawn: Math.min(row.drawn, k.count) };
		}),
		...[...rest]
			.sort(([a], [b]) => Number(a.startsWith('verder:')) - Number(b.startsWith('verder:')))
			.map(([id, r]) => {
				// A soort Verbonden has no group for: the whole of its collection, as the API counts it.
				// What a soort of Verbonden does not count has no whole but what is drawn.
				const whole = id.startsWith('canvas:')
					? buckets.filter((b) => b.collection === r.collection).reduce((n, b) => n + b.total, 0)
					: 0;
				return {
					...makeRow(id, r.label, whole || null, [], r.collection),
					further: id.startsWith('verder:') || undefined
				};
			})
	];

	// "Alle laden" where the API cut a collection off: once, at the row that draws most of it.
	for (const b of buckets) {
		if (b.kept >= b.total) continue;
		const c = b.collection as Collection;
		const best = rows
			.filter((r) => r.total != null && (drawnBy.get(r.id) ?? []).some((d) => d.collection === c))
			.sort((x, y) => y.drawn - x.drawn)[0];
		if (best) best.load = c;
	}
	return rows;
}

/** The count of a row: "9 van 29", or the one number when all are drawn or it is off. */
export function kindRowCount(r: KindRow, on: boolean): string {
	if (!on) return formatCount(r.total ?? r.drawn);
	return r.total != null
		? `${formatCount(r.drawn)} van ${formatCount(r.total)}`
		: formatCount(r.drawn);
}

/**
 * The bron Soort reads Verbonden of: the one bron of Omgeving, its neighbourhood's focus (or,
 * where that timed out, the bron Verbonden is of), and whether Verbonden is already that bron's
 * (`own`; till then Soort holds the place of its counts). A second step stands apart
 * (`direct`). A netwerk of several bronnen or a weergave of its own (Verband, Keten) draws what
 * no one bron's Verbonden lists: there Soort counts the canvas, per kind of the bronfilter.
 */
export function kindFocus(o: {
	netwerkActive: boolean;
	extern: boolean;
	reach: { focal: string } | null;
	panelId: string | null | undefined;
}): { id: string; own: boolean } | null {
	if (o.netwerkActive || o.extern) return null;
	const id = o.reach?.focal ?? o.panelId ?? null;
	if (!id) return null;
	return { id, own: !!o.panelId && o.panelId.toLowerCase() === id.toLowerCase() };
}

/**
 * The whole per collection the light node counts (`relation/collection/direction` → total),
 * where no neighbourhood came to say it (VVD: 200 stemmingen of 63.600, N2). Nothing to load
 * in full from it: its `kept` is its total.
 */
export function lightBuckets(buckets: ReadonlyMap<string, number> | null | undefined): Bucket[] {
	const per = new Map<string, number>();
	for (const [key, n] of buckets ?? []) {
		const c = key.split('/')[1];
		if (c) per.set(c, (per.get(c) ?? 0) + n);
	}
	return [...per].map(([collection, total]) => ({ collection, total, kept: total }));
}
