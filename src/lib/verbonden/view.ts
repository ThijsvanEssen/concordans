// What the panel, the table and the legend derive from the groups and the filter:
// the rows that pass, the counts, the groupings and the years of the judgments.
import { relationLabel, type Collection } from '$lib/vocabulary';
import {
	BRON_KINDS,
	formatCount,
	hiddenByKind,
	rowPasses,
	type BronKind,
	type VerbondenFilter
} from './filter';
import { groupCount, type Group } from './groups';
import type { Row } from './rows';

/** Whether the filter has a criterion that cuts inside a group, so its total no longer holds. */
export const cutsRows = (f: VerbondenFilter) =>
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
export const kindOfGroup = (g: Group): BronKind | null => g.rows[0]?.kind ?? null;

/** The groups with the rows that pass the filter; a group without rows is left out. */
export function filterGroups(groups: Group[], f: VerbondenFilter): Group[] {
	const cut = cutsRows(f);
	return groups
		.map((g) => {
			const rows = g.rows.filter((r) => rowPasses(r, f));
			return { ...g, rows, total: cut ? undefined : g.total, capped: cut ? false : g.capped };
		})
		.filter((g) => g.rows.length > 0);
}

export const allRows = (groups: Group[]): Row[] => groups.flatMap((g) => g.rows);

/** The number of verbindingen of a bron, the API's totals where it states them. */
export const totalCount = (groups: Group[]) => groups.reduce((sum, g) => sum + groupCount(g), 0);

/** The number shown after the filter: totals where they hold, else the rows that pass. */
export const shownCount = (groups: Group[], f: VerbondenFilter) =>
	filterGroups(groups, f).reduce((sum, g) => sum + groupCount(g), 0);

/** `1.104 verbindingen`, or `39 van 1.104 verbindingen` when a filter is active. */
export function countLine(groups: Group[], f: VerbondenFilter): string {
	const total = totalCount(groups);
	const shown = shownCount(groups, f);
	const noun = total === 1 ? 'verbinding' : 'verbindingen';
	return shown === total
		? `${formatCount(total)} ${noun}`
		: `${formatCount(shown)} van ${formatCount(total)} ${noun}`;
}

/** Per kind of bron, the number of verbindingen, the API's totals where they hold. */
export function kindTotals(groups: Group[]): Partial<Record<BronKind, number>> {
	const totals: Partial<Record<BronKind, number>> = {};
	for (const g of groups) {
		const byKind = new Map<BronKind, number>();
		for (const r of g.rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
		const first = kindOfGroup(g);
		for (const [kind, n] of byKind) {
			// The stated total of a group counts for the kind of its rows.
			const count = kind === first && byKind.size === 1 ? groupCount(g) : n;
			totals[kind] = (totals[kind] ?? 0) + count;
		}
	}
	return totals;
}

/** Per relation, the number of verbindingen and its label. */
export function relationCounts(
	groups: Group[],
	selection: Collection
): { relation: string; label: string; count: number }[] {
	const counts = new Map<string, number>();
	const labels = new Map<string, string>();
	for (const g of groups) {
		for (const r of g.rows) {
			if (!r.relation) continue;
			const source = r.direction === 'inbound' ? r.ref.collection : selection;
			const label = relationLabel(r.relation, source);
			labels.set(r.relation, label);
			counts.set(r.relation, (counts.get(r.relation) ?? 0) + 1);
		}
	}
	return [...counts]
		.map(([relation, count]) => ({ relation, label: labels.get(relation) ?? relation, count }))
		.sort((a, b) => b.count - a.count);
}

/** What the bronnen of the filter hide: `1.064 uitspraken verborgen`. */
export function hiddenLine(
	groups: Group[],
	f: VerbondenFilter
): { kind: BronKind; count: number }[] {
	return hiddenByKind(allRows(groups), kindTotals(groups), f);
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

export type Grouping = 'soort' | 'lid' | 'verbinding' | 'datum';

export const GROUPINGS: { id: Grouping; label: string }[] = [
	{ id: 'soort', label: 'Per soort' },
	{ id: 'lid', label: 'Per lid' },
	{ id: 'verbinding', label: 'Per verbinding' },
	{ id: 'datum', label: 'Op datum' }
];

const lidOrder = (a: string, b: string) =>
	a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'nl', { numeric: true });

/**
 * The groups regrouped: per lid (`Lid 2`, the rest under `Hele artikel`), per soort
 * verbinding, or per year, newest first. `soort` returns the groups as they are.
 */
export function regroup(groups: Group[], by: Grouping, selection: Collection): Group[] {
	if (by === 'soort') return groups;
	const rows = allRows(groups);
	const buckets = new Map<string, Row[]>();
	const keyOf = (r: Row): string => {
		if (by === 'lid') return r.lid ?? '';
		if (by === 'verbinding')
			return r.relation
				? relationLabel(r.relation, r.direction === 'inbound' ? r.ref.collection : selection)
				: '';
		return r.date ? r.date.slice(0, 4) : '';
	};
	for (const r of rows) {
		const k = keyOf(r);
		if (!buckets.has(k)) buckets.set(k, []);
		buckets.get(k)!.push(r);
	}
	const keys = [...buckets.keys()].sort((a, b) =>
		by === 'lid'
			? lidOrder(a, b)
			: by === 'datum'
				? a === ''
					? 1
					: b === ''
						? -1
						: b.localeCompare(a)
				: a.localeCompare(b, 'nl')
	);
	return keys.map((k) => ({
		id: `${by}:${k || 'geen'}`,
		label:
			by === 'lid'
				? k
					? `Lid ${k}`
					: 'Hele artikel'
				: by === 'datum'
					? k || 'Zonder datum'
					: k || 'Overige verbindingen',
		rows: buckets
			.get(k)!
			.slice()
			.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
		capped: false
	}));
}

/** Judgments per year, the last twelve years, for the bar chart of a group. */
export function yearHistogram(rows: Row[], years = 12): { year: number; count: number }[] {
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

export const KINDS_IN_ORDER = BRON_KINDS;
