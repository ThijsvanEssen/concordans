// The results page of a search (/zoeken?q=…): what a page of hits is made of, apart from
// the asking (results.svelte.ts) and the drawing (the route). Facets are counted over the hits
// the API gave, up to RESULT_LIMIT per kind; the API gives no counts of its own.
import type { Schema } from '$lib/api/types';
import { courtName } from '$lib/text/court';
import { queryHref } from '$lib/util/address';
import { extra } from './present';

type Hit = Schema<'SearchResultItem'>;

/** Hits asked per kind: the page shows them in groups and pages, the facets count them. */
export const RESULT_LIMIT = 50;

/** Hits a group shows on the overview, before "Alle …". */
export const OVERVIEW_ROWS = 5;

/** Hits a page shows once one kind is chosen. */
const PAGE_ROWS = 20;

/** Words of a query to try alone where it found nothing: the longer ones, at most three. */
export function narrowerWords(q: string): string[] {
	const words = [...new Set(q.split(/\s+/).filter((w) => w.length >= 4))];
	return words.length > 1 ? words.slice(0, 3) : [];
}

/** The court code and the year of a judgment, from its ECLI (`ECLI:NL:HR:2005:AU3313`). */
function eclipart(hit: Hit): { court: string; year: string } | null {
	const m = /^ECLI:[^:]+:([^:]+):(\d{4}):/i.exec(extra(hit, 'ecli'));
	return m ? { court: m[1].toUpperCase(), year: m[2] } : null;
}

/** The courts and the years of these judgments, each with its number of hits. */
export function judgmentFacets(hits: readonly Hit[]): {
	courts: Map<string, number>;
	years: Map<string, number>;
} {
	const courts = new Map<string, number>();
	const years = new Map<string, number>();
	for (const hit of hits) {
		const part = eclipart(hit);
		if (!part) continue;
		courts.set(part.court, (courts.get(part.court) ?? 0) + 1);
		years.set(part.year, (years.get(part.year) ?? 0) + 1);
	}
	const byCount = ([a, x]: [string, number], [b, y]: [string, number]) =>
		y - x || a.localeCompare(b);
	return {
		courts: new Map([...courts].sort(byCount)),
		years: new Map([...years].sort(([a], [b]) => b.localeCompare(a)))
	};
}

/** The judgments of a court and a year; '' for any. */
export function onlyJudgments(hits: readonly Hit[], court: string, year: string): Hit[] {
	if (!court && !year) return [...hits];
	return hits.filter((hit) => {
		const part = eclipart(hit);
		return !!part && (!court || part.court === court) && (!year || part.year === year);
	});
}

/** The name of a court by its code, never the code alone where the name is known. */
export const courtLabel = (code: string): string => courtName(code) ?? code;

/** One page of `hits`: the rows, the page (kept within the pages there are) and their number. */
export function pageOf<T>(
	hits: readonly T[],
	page: number,
	size = PAGE_ROWS
): { rows: T[]; page: number; pages: number } {
	const pages = Math.max(1, Math.ceil(hits.length / size));
	const at = Math.min(Math.max(1, Math.floor(page) || 1), pages);
	return { rows: hits.slice((at - 1) * size, at * size), page: at, pages };
}

/** The term of the curated list of concepts the hit was found by ("via begrip …"), or ''. */
export const conceptOf = (hit: Hit): string => hit.concept?.trim() ?? '';

/** The address of the page of results for a query, with the period it was asked in. */
export const resultsHref = (q: string, from = '', to = ''): string =>
	queryHref(
		'/zoeken',
		new URLSearchParams([['q', q], ...(from ? [['van', from]] : []), ...(to ? [['tot', to]] : [])])
	);
