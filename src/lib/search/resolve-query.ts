// What a query cites, as the API reads it: `/api/search?resolve=true` (API 0.74) answers
// with the notation the query is (`notation`, API 0.79.60: `TZ202603-130`, `Sr 287`,
// `Stcrt. 2026, 12`), with or without a match, and the bronnen a citation can mean. The
// search reads no notation itself.
import { withBook } from '$lib/text/bw';
import type { Schema } from '$lib/api/types';
import type { BronRef } from '$lib/bron/href';
import type { Collection } from '$lib/vocabulary';
import { anchorOf, parseQualifier } from '$lib/text/qualifier';
import { parsePad } from '$lib/bron/address';

export type Notation = Schema<'NotationDTO'>;

export type Resolved = {
	ref: BronRef;
	at: string | null;
	/** How the API names the bron ("Artikel 55 Grondwet"), when it says. */
	label?: string | null;
};

// "AVG", "Awb", "UAVG": one word of up to ten letters with a capital, as a law is abbreviated.
const ABBREVIATION = /^(?=\S*[A-Z])[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.]{1,9}$/;

/** The query when it may abbreviate a law ("AVG"), for the API to name; null otherwise. */
export function lawAbbreviation(query: string): string | null {
	const q = query.trim();
	return ABBREVIATION.test(q) ? q : null;
}

// The name of a regeling: "Omgevingswet", "Handelsregisterwet 2007", "Wet op de
// rechterlijke organisatie", "Besluit bouwwerken leefomgeving". Eight words at most.
const LAW_END = /\p{L}(wet|wetboek|besluit|regeling|verordening|reglement)(\s+\d{4})?$/iu;
const LAW_START = /^(wet|wetboek|besluit|regeling|verordening|reglement)\s+\p{L}/iu;

/** The query when it names a regeling by its title, for the API to find; null otherwise. */
export function lawTitle(query: string): string | null {
	const q = query.trim().replace(/\s+/g, ' ');
	if (q.split(' ').length > 8 || /[0-9]:/.test(q)) return null;
	return LAW_END.test(q) || LAW_START.test(q) ? q : null;
}

/** What a citation row is marked as before the API names its bron: the kind of its notation. */
export const NOTATION_COLLECTION: Record<Notation['kind'], Collection> = {
	ecli: 'judgments',
	ljn: 'judgments',
	bwb: 'instruments',
	celex: 'instruments',
	publication: 'instruments',
	dossier: 'dossiers',
	document: 'documents',
	article: 'articles',
	commitment: 'commitments'
};

/**
 * The bron an answer of the API names, as /api/search gives it with `resolve=true` (API 0.74,
 * BE-16); null for none.
 */
export function resolvedOf(data: Schema<'ResolveResponse'> | null | undefined): Resolved | null {
	const match = data?.match;
	return match ? resolvedMatch(match, data?.qualifier) : null;
}

/** A dossier by the number its address carries (`/dossiers/21501-31`), as a link names it. */
function refOfMatch(match: Schema<'ResolveMatch'>): BronRef | null {
	if (match.collection !== 'dossiers') return { collection: match.collection, key: match.key };
	const pad = parsePad(match.path ?? '');
	return pad?.soort === 'dossier'
		? { collection: 'dossiers', key: match.key, number: pad.nummer }
		: null;
}

function resolvedMatch(
	match: Schema<'ResolveMatch'>,
	qualifier: string | null | undefined
): Resolved | null {
	const ref = refOfMatch(match);
	if (!ref) return null;
	return {
		ref,
		at: anchorOf(parseQualifier(qualifier ?? '')),
		// "Artikel 162 Burgerlijk Wetboek Boek 6" as it is cited: "Artikel 6:162 BW". A dossier
		// as it was typed: its display name is the title of three lines.
		label:
			ref.collection === 'judgments'
				? (match.title ?? null)
				: match.display_name && ref.collection !== 'dossiers'
					? withBook(match.display_name)
					: null
	};
}

/**
 * The bronnen a citation can mean where it is not one: "artikel 3 BW" is in Boek 1, 3, 6 and
 * more. The API names them as `alternatives` beside no match, the most cited first and the
 * order of the books between equals (#310), at most ten of `alternatives_total`; the lid
 * applies to each.
 */
export function keuzesOf(data: Schema<'ResolveResponse'> | null | undefined): {
	items: Resolved[];
	total: number;
} {
	if (!data || data.match) return { items: [], total: 0 };
	const items = (data.alternatives ?? [])
		.map((m) => resolvedMatch(m, data.qualifier))
		.filter((r): r is Resolved => r !== null);
	const total = data.alternatives_total ?? items.length;
	return { items, total: Math.max(total, items.length) };
}
