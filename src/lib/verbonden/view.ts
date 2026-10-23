// What the panel, the table and the legend derive from the groups and the filter:
// the rows that pass, the counts, the groupings and the years of the judgments.
import { capitalize, plural } from '$lib/text/words';
import type { Collection } from '$lib/vocabulary';
import { relationLabel } from './relation-words';
import { sumLidCounts } from '$lib/api/nodes';
import { hiddenByGroup, rowPasses, type FilterGroup, type VerbondenFilter } from './filter';
import { atLeast, formatCount } from '$lib/text/getal';
import { groupCount, type Group } from './groups';
import type { Row } from './rows';

/** The rows a closed group of the panel shows, and holds the place of while they come. */
export const PREVIEW_ROWS = 3;

/** Whether the filter has a criterion that cuts inside a group, so its total no longer holds. */
const cutsRows = (f: VerbondenFilter) =>
	f.lid !== null ||
	f.rechter !== null ||
	f.van !== null ||
	f.tot !== null ||
	f.geldendOp !== null ||
	f.betrouwbaarheid !== null ||
	f.status !== null ||
	f.jaar !== null ||
	f.zoek !== '';

/** The kind a group counts for: that of its rows. */
const filterGroupOfRows = (g: Group): FilterGroup | null => g.rows[0]?.filterGroup ?? null;

/**
 * The groups with the rows that pass the filter; a group without rows is left out, unless
 * its loader is still under way (`wachtend`) or failed, and no filter cuts rows: it keeps
 * its place.
 */
export function filterGroups(
	groups: Group[],
	f: VerbondenFilter,
	wachtend: ReadonlySet<string> = new Set()
): Group[] {
	const cut = cutsRows(f);
	return groups
		.map((g) => {
			const rows = g.rows.filter((r) => rowPasses(r, f));
			// A name that follows its rows follows the rows the filter leaves.
			const label = g.labelOf ? g.labelOf(rows) : g.label;
			// What the loader asked of the API itself (the year of a wet's judgments, BE-51; the
			// year and the rechter of an article's): its total is that of the cut, and holds.
			const holds =
				!cut ||
				(!!g.cutBy?.length &&
					!cutsRows({
						...f,
						jaar: g.cutBy.includes('jaar') ? null : f.jaar,
						rechter: g.cutBy.includes('rechter') ? null : f.rechter
					}));
			return {
				...g,
				label,
				rows,
				total: holds ? g.total : undefined,
				capped: holds ? g.capped : false,
				// A group still loading has no rows to tell its kind by: its noun names it.
				laden:
					rows.length === 0 &&
					!cut &&
					wachtend.has(g.id) &&
					(!f.bronnen || f.bronnen.has(g.noun as FilterGroup))
			};
		})
		.filter((g) => g.rows.length > 0 || g.laden || (g.failed && !cut));
}

export const allRows = (groups: Group[]): Row[] => groups.flatMap((g) => g.rows);

/**
 * `324 vermeldingen in 170 uitspraken` for the groups whose rows bundle several places
 * in one bron; null when no group does.
 */
export function mentionLine(groups: Group[]): string | null {
	const bundled = groups.filter((g) => g.mentions != null || g.rows.some((r) => r.mentions));
	if (bundled.length === 0) return null;
	const mentions = bundled.reduce(
		(sum, g) => sum + (g.mentions ?? g.rows.reduce((n, r) => n + (r.mentions?.length ?? 1), 0)),
		0
	);
	const bronnen = bundled.reduce((sum, g) => sum + groupCount(g), 0);
	const noun = bundled.every((g) => g.noun === bundled[0].noun) ? bundled[0].noun : null;
	return `${formatCount(mentions)} vermeldingen in ${formatCount(bronnen)} ${noun ?? 'bronnen'}`;
}

/** The number of verbindingen of a bron, the API's totals where it states them. */
export const totalCount = (groups: Group[]) => groups.reduce((sum, g) => sum + groupCount(g), 0);

/** The number shown after the filter: totals where they hold, else the rows that pass. */
export const shownCount = (
	groups: Group[],
	f: VerbondenFilter,
	wachtend: ReadonlySet<string> = new Set()
) => filterGroups(groups, f, wachtend).reduce((sum, g) => sum + groupCount(g), 0);

/**
 * The groups as they will count once every loader is in (UX-toets 0.79.47, #56): a group whose
 * loader is under way counts what the light node foretells for it (`verwacht`). Null while a
 * waiting group has no forecast: its count is not known, and the head waits for it rather than
 * jump ("4.793 verbindingen", then "5.404").
 */
export function vasteGroepen(
	groups: Group[],
	wachtend: readonly string[] = [],
	verwacht: Readonly<Record<string, number>> = {}
): Group[] | null {
	const w = new Set(wachtend);
	let onbekend = false;
	const out = groups.map((g) => {
		if (!w.has(g.id) || g.total != null) return g;
		const n = verwacht[g.id];
		if (n == null) onbekend = true;
		return n == null ? g : { ...g, total: n };
	});
	return onbekend ? null : out;
}

/** `1.104 verbindingen`, or `39 van 1.104 verbindingen` when a filter is active. */
export function countLine(
	groups: Group[],
	f: VerbondenFilter,
	wachtend: ReadonlySet<string> = new Set()
): string {
	const total = totalCount(groups);
	const shown = shownCount(groups, f, wachtend);
	const noun = plural(total, 'verbinding', 'verbindingen');
	const heel = atLeast(total, minstens(groups));
	return shown === total
		? `${heel} ${noun}`
		: `${shownLabel(groups, f, wachtend)} van ${heel} ${noun}`;
}

// A group the API cut off counts what it holds: the sum is more, as its own `meer dan 30`.
const minstens = (gs: Group[]) => gs.some(afgekapt);

/** The number after the filter as the count line writes it: `164`, or `meer dan 164`. */
export const shownLabel = (
	groups: Group[],
	f: VerbondenFilter,
	wachtend: ReadonlySet<string> = new Set()
) => atLeast(shownCount(groups, f, wachtend), minstens(filterGroups(groups, f, wachtend)));

/** A group with more rows than it holds and no total from the API (`meer dan 30`). */
const afgekapt = (g: Group) => !!g.capped && !(g.total != null && g.total >= g.rows.length);

/** Per kind of bron, the number of verbindingen, the API's totals where they hold. */
export function groupTotals(groups: Group[]): Partial<Record<FilterGroup, number>> {
	const totals: Partial<Record<FilterGroup, number>> = {};
	for (const g of groups) {
		const byKind = new Map<FilterGroup, number>();
		for (const r of g.rows) byKind.set(r.filterGroup, (byKind.get(r.filterGroup) ?? 0) + 1);
		const first = filterGroupOfRows(g);
		for (const [kind, n] of byKind) {
			// The stated total of a group counts for the kind of its rows.
			const count = kind === first && byKind.size === 1 ? groupCount(g) : n;
			totals[kind] = (totals[kind] ?? 0) + count;
		}
	}
	return totals;
}

/**
 * Per relation, the number of verbindingen and its label: every word its rows say, the most
 * said first (`haalt aan, verwijst naar` on an article cited by judgments and articles alike).
 */
export function relationCounts(
	groups: Group[],
	selection: Collection
): { relation: string; label: string; count: number }[] {
	const counts = new Map<string, number>();
	const labels = new Map<string, Map<string, number>>();
	for (const g of groups) {
		for (const r of g.rows) {
			if (!r.relation) continue;
			const label = rowLabel(r, selection);
			const per = labels.get(r.relation) ?? new Map<string, number>();
			per.set(label, (per.get(label) ?? 0) + 1);
			labels.set(r.relation, per);
			counts.set(r.relation, (counts.get(r.relation) ?? 0) + 1);
		}
	}
	return [...counts]
		.map(([relation, count]) => ({
			relation,
			label: [...(labels.get(relation) ?? new Map<string, number>())]
				.sort((a, b) => b[1] - a[1])
				.map(([l]) => l)
				.join(', '),
			count
		}))
		.sort((a, b) => b.count - a.count);
}

/** The label of a row's verbinding, read from its source (relation-words.ts). */
export function rowLabel(r: Row, selection: Collection): string {
	if (!r.relation) return '';
	const inbound = r.direction === 'inbound';
	return relationLabel(
		r.relation,
		inbound ? r.ref.collection : selection,
		inbound ? selection : r.ref.collection,
		r.edge
	);
}

/** What the bronnen of the filter hide: `1.064 uitspraken verborgen`. */
export function hiddenLine(
	groups: Group[],
	f: VerbondenFilter
): { group: FilterGroup; count: number }[] {
	return hiddenByGroup(allRows(groups), groupTotals(groups), f);
}

/** The bron kinds the buckets of a collection hold, as far as an article's lid counts go. */
const GROUPS_OF_BUCKET: Record<string, FilterGroup[]> = {
	judgments: ['uitspraken'],
	articles: ['artikelen'],
	documents: ['toelichtingen', 'wetsvoorstellen', 'dossiers']
};

/**
 * An article's counts per lid under the bronfilter, from the API's per bucket (`lid_counts`):
 * the buckets of the kinds that are on. Null where the filter splits what one bucket holds
 * (toelichtingen without wetsvoorstellen): then the rows count.
 */
export function lidTellingenOnder(
	per: Map<string, Map<string, number>>,
	bronnen: ReadonlySet<FilterGroup> | null
): Map<string, number> | null {
	if (!bronnen) return sumLidCounts(per);
	for (const collection of per.keys()) {
		const kinds = GROUPS_OF_BUCKET[collection];
		const on = kinds ? kinds.filter((k) => bronnen.has(k)).length : 0;
		if (!kinds || (on > 0 && on < kinds.length)) return null;
	}
	return sumLidCounts(per, (c) => GROUPS_OF_BUCKET[c].some((k) => bronnen.has(k)));
}

/** Rows per lid of the selected article, the ones without a lid under `Hele artikel`. */
export function lidCounts(rows: Row[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const r of rows) {
		const k = r.lid ?? '';
		counts.set(k, (counts.get(k) ?? 0) + 1);
	}
	return counts;
}

/** The years a group's chart of judgments shows: the last twelve. */
const YEARS_IN_CHART = 12;

/** Judgments per year, the last YEARS_IN_CHART years, for the bar chart of a group. */
export function yearHistogram(
	rows: Row[],
	years = YEARS_IN_CHART
): { year: number; count: number }[] {
	const counts = new Map<number, number>();
	let last = 0;
	for (const r of rows) {
		const y = r.date ? Number(r.date.slice(0, 4)) : NaN;
		if (!Number.isFinite(y)) continue;
		counts.set(y, (counts.get(y) ?? 0) + 1);
		last = Math.max(last, y);
	}
	if (!last) return [];
	return Array.from({ length: years }, (_, i) => {
		const year = last - years + 1 + i;
		return { year, count: counts.get(year) ?? 0 };
	});
}
