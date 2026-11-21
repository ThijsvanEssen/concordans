// What the page of a search that found nothing (or nearly nothing) offers: the one line of
// what was not read, and the places to browse. Drawn by ZoekHulp.svelte, in the page of
// results and in the dialog alike; the words come from the API's `searched`.
import type { Schema } from '$lib/api/types';
import { SOURCES } from '$lib/nav/sources';
import { SEARCHED } from '$lib/text/coverage';
import { joinAnd } from '$lib/text/words';
import { groupLabel } from './present';
import type { SearchKind } from './lanes';

type Searched = Schema<'SearchedDTO'>;

/** Hits at or under which the words are offered one by one: one or two is nearly nothing. */
export const FEW_HITS = 2;

/**
 * Where the kinds whose text is not read were searched: `Gezocht in titels, namen en nummers,
 * niet in de tekst van Kamerstukken en uitspraken`. Null where every kind is read in its text.
 */
export function unreadLine(searched: Partial<Record<SearchKind, Searched>>): string | null {
	const unread = (Object.entries(searched) as [SearchKind, Searched][]).filter(
		([, s]) => s.completeness.text?.state === 'none'
	);
	if (!unread.length) return null;
	const fields = [...new Set(unread.flatMap(([, s]) => s.fields))].filter((f) => f !== 'text');
	const kinds = unread.map(([kind]) => (kind === 'documents' ? 'Kamerstukken' : groupLabel(kind)));
	const names = joinAnd(kinds.map((k) => k.toLowerCase()));
	return `Gezocht in ${joinAnd(fields.map((f) => SEARCHED[f]))}, niet in de tekst van ${names}`;
}

/** The places to browse, the five rubrieken in their order. */
export const BROWSE = SOURCES.map((s) => ({ label: s.label, href: s.href }));
