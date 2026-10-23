// A list of Bronnen in one place: its sorts, field, columns, request, filters and rows
// (lists/<category>.ts). IndexView holds the address, the loading, the way back and the
// frame, the same for every list.
import type { Component, Snippet } from 'svelte';
import type { FacetGroup } from '../facets';
import type { FacetsApart } from '../faceted';
import type { Cabinet, Ministry } from '../government';
import type { IndexCategory } from '../categories';
import type { Coverage } from '$lib/api/stats';
import type { Schema } from '$lib/api/types';
import { LIST_PAGE } from '$lib/api/first-pages';
import type { IndexParam, IndexParams, IndexPatch } from './params';

/** The rows a list asks at a time (first-pages.json). */
export const PAGE = LIST_PAGE;

/** The first option is the default. With `dir` it is sorted here, else by the API. */
export type SortDef = { id: string; label: string; dir?: 'asc' | 'desc' };

/** The heads over the three columns of a row, and the width of the aside (the lead's is --row-lead). */
export type Columns = { lead: string; body: string; aside: string | string[]; asideW: number };

/** What a request gives: the rows and, where it counts them, the total. */
export type Answer<Row> = { items: Row[]; total?: number | null; of?: unknown };

/** The rows loaded so far; `total` null when the API gives none and more may follow. */
export type Page<Row> = { items: Row[]; total: number | null; more: boolean; of?: unknown };

/** A list's own state beside its rows (its facets, a count asked apart), set as it comes. */
type SetState<State> = (patch: Partial<State>) => void;

/** What more than one list reads: the government and the courts, and the sitting fracties. */
export type Shared = {
	cabinets: Cabinet[];
	ministries: Ministry[];
	coverage: Coverage | null;
	/** The sitting fracties of the Kamer shown, to filter its members by, with their seats. */
	parties: { abbreviation: string; seats: number | null }[];
};

/** The data a list's request needs before it can be read. */
type Need = 'government' | 'coverage' | 'parties';

/** Everything a list's filters and rows are drawn from. */
export type ListContext<Row, State> = {
	p: IndexParams;
	sort: SortDef;
	dir: 'asc' | 'desc' | undefined;
	/** The rows as shown: filtered and sorted where the API does not. */
	rows: Row[] | undefined;
	/** The page as loaded. */
	page: Page<Row> | undefined;
	state: Partial<State>;
	shared: Shared;
	loading: boolean;
	patch: (patch: IndexPatch) => void;
	toggleOpen: (id: string) => void;
	/** The groups of rows opened (a dossier number's dossiers), kept across the lists. */
	openGroups: ReadonlySet<string>;
	toggleGroup: (key: string) => void;
	tabHref: (category: IndexCategory, filters?: IndexPatch) => string;
	/** Nothing to show, in the list's words. */
	empty: Snippet<[string]>;
};

export type ViewProps<Row, State> = { ctx: ListContext<Row, State> };

export type List<Row, State extends object, Query> = {
	sorts: readonly SortDef[] | ((p: IndexParams) => readonly SortDef[]);
	placeholder: string;
	columns: Columns | ((p: IndexParams) => Columns);
	/** The bronnen in the plural, as the empty list and Volgende say them. */
	noun: string;
	/** The empty list in its own words (the open dossiers). */
	emptyNoun?(p: IndexParams): string;
	/** A way on from an empty list besides the search in all bronnen. */
	widen?(p: IndexParams): { label: string; patch: IndexPatch } | null;
	/** The list holds one Kamer at a time: the choose-line has the Kamer. */
	chamber?: true;
	/** What must be loaded beside the rows. */
	needs?: readonly Need[];
	/** The period of the list, the date it is about named by `label`. */
	period(p: IndexParams): { label: string; unit: 'year' | 'date' } | null;
	/** The request of the rows, from the address; a new one loads the list again. */
	query(p: IndexParams, sort: SortDef): Query;
	/** The rows from `offset`; on the first page the list's state through `apart` and `set`. */
	load(
		query: Query,
		offset: number,
		signal: AbortSignal,
		apart: FacetsApart,
		set: SetState<State>
	): Promise<Answer<Row>>;
	/** The deepest `offset` the API pages to (422 beyond it); further, `beyond` asks a window of dates. */
	reach?: number;
	/**
	 * The request that goes on from the rows loaded when they pass `reach`: the same list from
	 * the last day it showed, and the offset into that day. Null where it cannot go on.
	 */
	beyond?(query: Query, loaded: Row[]): { query: Query; offset: number } | null;
	/** The total where the rows come without it (the stemmingen: from their facets). */
	total?(state: Partial<State>): number | null;
	/** The rows as shown, where the API cannot filter or sort them. */
	shown?(rows: Row[], ctx: Omit<ListContext<Row, State>, 'rows'>): Row[];
	/** Filtered here: the count is of the rows shown, not the API's total. */
	countShown?: true;
	facets(ctx: ListContext<Row, State>): FacetGroup[];
	/** The source of the Eerste Kamer's composition, which its rows carry. */
	composition?(rows: Row[]): Schema<'EkSourceDTO'> | null | undefined;
	/** Above the count (the hall of the Kamer). */
	Header?: Component<ViewProps<Row, State>>;
	/** Between the count and the rows (the years, the cabinets in time, the posts). */
	Figure?: Component<ViewProps<Row, State>>;
	/** After the count, from the counts the list has already (`12 aangenomen`); null where it has none. */
	summary?(ctx: ListContext<Row, State>): string | null;
	/** The rows, in their own <ul class="list">; a list without them shows its Figure only. */
	Rows?: Component<ViewProps<Row, State>>;
	/** Whether the rows show, where they can say no more than the Header (default: always). */
	rowsShown?(p: IndexParams): boolean;
	/**
	 * The list as a feed (the Atom feed of the API): its filters in the feed's words. Null where a filter
	 * is chosen the feed has no word for; there the list offers no Volg.
	 */
	follow?(p: IndexParams): Record<string, string | readonly string[] | undefined> | null;
	/** The source the rows come from alone, as `data_as_of` names it (the EHRM: `echr`). */
	source?(p: IndexParams): string | null;
	/** A line under the rows (the source of the Eerste Kamer's stemmingen). */
	after?(p: IndexParams): { label: string; href: string } | null;
};

/** A list as IndexView handles every list, its rows and state of no type in particular. */
export type IndexList = List<unknown, Record<string, unknown>, unknown>;

/** A list in the register: typed where it is written, as any list where it is used. */
export const defineList = <Row, State extends object, Query>(
	list: List<Row, State, Query>
): IndexList => list as unknown as IndexList;

/** A sorts or columns of a list, for this address. */
export const forParams = <T>(value: T | ((p: IndexParams) => T), p: IndexParams): T =>
	typeof value === 'function' ? (value as (p: IndexParams) => T)(p) : value;

/** The rows by the key of the sort chosen; a sort without a key leaves the API's order. */
export function sorted<T>(
	rows: T[],
	keys: Record<string, (row: T) => string | number>,
	sort: SortDef,
	dir: 'asc' | 'desc' | undefined
): T[] {
	const key = keys[sort.id];
	if (!key) return rows;
	const sign = dir === 'asc' ? 1 : -1;
	return [...rows].sort((a, b) => {
		const [x, y] = [key(a), key(b)];
		return (typeof x === 'number' ? x - (y as number) : x.localeCompare(y as string, 'nl')) * sign;
	});
}

/** A facet of the API as value → count; each dimension counted without its own filter. */
export const facetMap = (
	facet: { value?: string | boolean | null; count: number }[] | null | undefined
) => new Map((facet ?? []).map((f) => [String(f.value), f.count]));

/** A filter of one value: on, or off when it was on. */
export const toggle =
	(
		patch: ListContext<unknown, object>['patch'],
		name: IndexParam,
		current: string | undefined,
		value: string
	) =>
	() =>
		patch({ [name]: current === value ? null : value });

/** A filter that is on or off (`1`). */
export const flag =
	(patch: ListContext<unknown, object>['patch'], name: IndexParam, on: boolean) => () =>
		patch({ [name]: on ? null : '1' });

/** The number of each value among the rows. */
export function countBy<T, K>(rows: T[] | undefined, key: (row: T) => K): Map<K, number> {
	const counts = new Map<K, number>();
	for (const row of rows ?? []) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
	return counts;
}

/** The search text of the address in a name, ignoring case. */
export const matches = (q: string, text: string | null | undefined) =>
	(text ?? '').toLowerCase().includes(q.toLowerCase());
