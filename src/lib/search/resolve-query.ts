// `GET /api/resolve` (API 0.5) turns a citation into one bron. `resolveQuery` asks it
// first and, where it is absent or finds nothing, parses the notation itself.
// TODO(backend B11): the parser and the lookups below go when every notation resolves.
import { BW_BOOKS, withBook } from '$lib/text/bw';
import { getArticleDetail } from '$lib/api/articles';
import { getDossier, getDossierDocuments } from '$lib/components/parliamentary/data';
import { api, unwrap } from '$lib/api/client';
import type { Schema } from '$lib/api/types';
import type { BronRef } from '$lib/bron/href';
import { parseNodeId, type Collection } from '$lib/vocabulary';
import { anchorOf, parseQualifier } from '$lib/text/qualifier';
import { lookUp, type Pad, type Reeks } from '$lib/bron/leesbaar';

export type Citation =
	| { kind: 'ecli'; ecli: string }
	| { kind: 'article'; number: string; law: string; book: string | null; at: string | null }
	| { kind: 'dossier'; number: string; document: string | null }
	| { kind: 'bwb'; id: string }
	| { kind: 'celex'; id: string }
	| { kind: 'publication'; series: Reeks; year: string; number: string };

export type Resolved = {
	ref: BronRef;
	at: string | null;
	/** How the API names the bron ("Artikel 55 Grondwet"), when it says. */
	label?: string | null;
};

// "Stb. 2026, 94", "Staatsblad 2026, 94", "Stcrt. 2026, nr. 12345", "Trb. 2018, 201".
const PUBLICATION =
	/^(stb|staatsblad|stcrt|staatscourant|trb|tractatenblad)\.?\s*(\d{4}),?\s*(?:nr\.?\s*)?(\d+)$/i;
const SERIES: Record<string, Reeks> = {
	stb: 'stb',
	staatsblad: 'stb',
	stcrt: 'stcrt',
	staatscourant: 'stcrt',
	trb: 'trb',
	tractatenblad: 'trb'
};
const ECLI = /^ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]+$/i;
const BWB = /^BWB[RVW]\d{7}$/i;
const CELEX = /^[0-9CE]\d{4}[A-Z]{1,2}\d{4}(?:R\(\d+\))?$/i;
// A dossier number with its suffix: `36327`, `37020-XV`, `23908-(R1519)`. A digit suffix
// (`21501-31`) reads as a paper number; `resolveQuery` asks the API which it is. Cited in
// full, with Kamer and vergaderjaar: "Kamerstukken II 2025/26, 36799, nr. 31", and an
// Eerste Kamer paper by its letter: "Kamerstukken I 2025/26, 36799, A".
const DOSSIER =
	/^(?:kamerstuk(?:ken)?\s+(?:I{1,2}\s+)?(?:\d{4}\s*[/-]\s*\d{2,4},?\s+)?)?(\d{5}(?:-(?:[A-Z]+|\([A-Z0-9]+\)))?)(?:\s*-\s*(\d+)|,?\s*nr\.?\s*(\d+|[A-Z]{1,2})|,\s*([A-Z]{1,2}))?$/i;
// "artikel 287 Sr", "art. 6:162 BW", "art. 359a lid 1 onder b Sv", "artikel 3:4, tweede lid, Awb".
const ARTICLE = /^art(?:ikel|\.)?\s*(?:(\d+[a-z]?):)?(\d+[a-z]*(?:\.\d+[a-z]*)*)(?![\w:])(.*)$/i;
// What stands between the article number and the law: ", tweede lid,", "lid 1 onder b".
const QUALIFIER =
	/,?\s*(?:(?:[a-z]+de|[a-z]+ste)(?:\s+en\s+[a-z]+(?:de|ste))?\s+lid|lid\s+\d+[a-z]?|aanhef(?:\s+en)?|(?:onderdeel|onder|sub)\s+(?:\d+\s*°?|[a-z]{1,2})(?![a-z]))\s*,?/gi;

// "55 Gw", "6:162 BW", "3:4 Awb, tweede lid": an article cited without "art.". Too close
// to plain words ("2024 begroting") to be taken as a citation on sight: `bareArticle`
// only writes it out, and the API decides whether a law of that name has the article.
const BARE_ARTICLE = /^(\d{1,4}[a-z]{0,2}(?::\d{1,4}[a-z]{0,2})?)\s+([A-Za-zÀ-ÿ][^\d]*)$/i;
const YEAR = /^(?:1[89]|20)\d{2}$/;

/** "55 Gw" as the citation "art. 55 Gw", or null when the query does not have that form. */
export function bareArticle(query: string): string | null {
	const q = query.trim().replace(/\s+/g, ' ');
	const m = BARE_ARTICLE.exec(q);
	if (!m || YEAR.test(m[1])) return null;
	const citation = `art. ${q}`;
	return parseCitation(citation)?.kind === 'article' ? citation : null;
}

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

const isBW = (law: string) => /^(bw|burgerlijk wetboek)$/i.test(law.trim());

/** The citation a query is, or null when it is words to search for. */
export function parseCitation(query: string): Citation | null {
	const q = query.trim().replace(/\s+/g, ' ');
	if (!q) return null;
	if (ECLI.test(q)) return { kind: 'ecli', ecli: q.toUpperCase() };
	if (BWB.test(q)) return { kind: 'bwb', id: q.toUpperCase() };
	if (CELEX.test(q)) return { kind: 'celex', id: q.toUpperCase() };
	const publication = PUBLICATION.exec(q);
	if (publication)
		return {
			kind: 'publication',
			series: SERIES[publication[1].toLowerCase()],
			year: publication[2],
			number: publication[3]
		};
	const dossier = DOSSIER.exec(q);
	if (dossier) {
		return {
			kind: 'dossier',
			number: dossier[1].toUpperCase(),
			document: (dossier[2] ?? dossier[3] ?? dossier[4])?.toUpperCase() ?? null
		};
	}
	const article = ARTICLE.exec(q);
	if (article) {
		const [, book, number, rest] = article;
		const law = rest
			.replace(QUALIFIER, ' ')
			.replace(/^(?:\s|,|van de|van het|van)+/i, '')
			.trim();
		if (!/^[A-Za-zÀ-ÿ]/.test(law)) return null;
		// In the Burgerlijk Wetboek the part before the colon is the boek; elsewhere
		// (Awb 3:4) it belongs to the article number.
		const bw = isBW(law);
		return {
			kind: 'article',
			number: book && !bw ? `${book}:${number}` : number,
			law: law.trim(),
			book: book && bw ? book.toLowerCase() : null,
			at: anchorOf(parseQualifier(rest))
		};
	}
	return null;
}

export type ResolveDeps = {
	/** `GET /api/resolve`; null when the API has no such route or no match. */
	resolve: (query: string) => Promise<Resolved | null>;
	/** bwb_id of the law an abbreviation or name stands for, as the API's search reads it. */
	lawId: (law: string, articleNumber: string) => Promise<string | null>;
	/** Node key of an article, or null when the law has no such article. */
	articleKey: (bwbId: string, articleNumber: string) => Promise<string | null>;
	/** Node key of document `nr` of a dossier. */
	documentKey: (dossier: string, nr: string) => Promise<string | null>;
	/** Node key and label of the dossier a number names, or null when there is none. */
	dossier: (number: string) => Promise<{ key: string; number: string } | null>;
	exists: (ref: BronRef) => Promise<boolean>;
	/** The bron a readable address names, by /api/lookup (API 0.73): exact or null. */
	lookUp: (pad: Pad) => Promise<string | null>;
};

const RESOLVE_KINDS: Record<string, Collection> = {
	article: 'articles',
	instrument: 'instruments',
	judgment: 'judgments',
	document: 'documents'
};

const apiDeps: ResolveDeps = {
	resolve: async (q) => {
		const { data, response } = await api.GET('/api/resolve', { params: { query: { q } } });
		return response.ok ? resolvedOf(data) : null;
	},
	lawId: async (law, articleNumber) => {
		// The API's parser stops at a colon, so it is asked for the part before it.
		const q = `art. ${articleNumber.split(':')[0]} ${law}`;
		const found = await unwrap(
			api.GET('/api/search', { params: { query: { q, types: ['articles'], limit: 1 } } })
		);
		const bwb = found.results.articles?.[0]?.extra?.bwb_id;
		return typeof bwb === 'string' ? bwb : null;
	},
	articleKey: (bwbId, articleNumber) =>
		getArticleDetail(bwbId, articleNumber)
			.then((d) => d.article.key ?? null)
			.catch(() => null),
	documentKey: async (dossier, nr) => {
		const data = await getDossierDocuments(dossier).catch(() => null);
		const wanted = nr.toLowerCase();
		const hit = data?.items.find(
			(d) => String(d.sequence ?? '') === wanted || d.key.toLowerCase().endsWith(`_${wanted}`)
		);
		return hit?.key ?? null;
	},
	dossier: (number) =>
		getDossier(number)
			.then((d) => ({ key: d.key, number: d.number }))
			.catch(() => null),
	lookUp: (pad) => lookUp(pad),
	exists: async ({ collection, key }) => {
		const { response } = await api.GET('/api/nodes/{collection}/{key}', {
			params: { path: { collection, key }, query: { limit: 1 } }
		});
		return response.ok;
	}
};

/**
 * The bron an answer of /api/resolve names, as /api/resolve gives it and as /api/search
 * does with `resolve=true` (API 0.74, BE-16); null for none, and for a dossier, which is
 * looked up by its number instead (a dossier match carries no label).
 */
export function resolvedOf(data: Schema<'ResolveResponse'> | null | undefined): Resolved | null {
	const match = data?.match;
	const collection = match && (RESOLVE_KINDS[match.kind] ?? null);
	if (!match || !collection || collection === 'dossiers') return null;
	return {
		ref: { collection, key: match.key },
		at: anchorOf(parseQualifier(data?.qualifier ?? '')),
		// "Artikel 162 Burgerlijk Wetboek Boek 6" as it is cited: "Artikel 6:162 BW".
		label: match.display_name ? withBook(match.display_name) : null
	};
}

const nodeKey = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, '_');

/**
 * The bron a citation points at, or null: then the query is searched as words.
 * A target is returned only after the API confirmed it exists.
 */
export async function resolveQuery(
	query: string,
	deps: ResolveDeps = apiDeps
): Promise<Resolved | null> {
	const c = parseCitation(query);
	if (!c) return null;
	try {
		// A Kamerstuk with its number, a publication: the stuk itself, by lookup, exact.
		const pad: Pad | null =
			c.kind === 'publication'
				? { soort: 'publicatie', reeks: c.series, jaar: c.year, nummer: c.number }
				: c.kind === 'dossier' && c.document
					? { soort: 'kamerstuk', dossier: c.number, nummer: c.document }
					: null;
		const found = pad ? await deps.lookUp(pad).catch(() => null) : null;
		const target = found ? parseNodeId(found) : null;
		// A stuk or a publication; a dossier (a Kamerstuk without number) goes the way below.
		if (target && target.collection !== 'dossiers')
			return { ref: { collection: target.collection, key: target.key } as BronRef, at: null };
		if (c.kind === 'publication') return null;
		const resolved = await deps.resolve(query).catch(() => null);
		if (resolved) return resolved;
		if (c.kind === 'article') {
			const bwb = c.book ? BW_BOOKS[c.book] : await deps.lawId(c.law, c.number);
			const key = bwb ? await deps.articleKey(bwb, c.number) : null;
			return key ? { ref: { collection: 'articles', key }, at: c.at } : null;
		}
		if (c.kind === 'dossier') {
			// `21501-31` is a dossier of its own; `36327-3` is paper 3 of dossier 36327.
			const labelled = c.document && (await deps.dossier(`${c.number}-${c.document}`));
			if (labelled) {
				return {
					ref: { collection: 'dossiers', key: labelled.key, number: labelled.number },
					at: null
				};
			}
			const key = c.document && (await deps.documentKey(c.number, c.document));
			if (key) return { ref: { collection: 'documents', key }, at: null };
			const dossier = await deps.dossier(c.number);
			return dossier
				? { ref: { collection: 'dossiers', key: dossier.key, number: dossier.number }, at: null }
				: null;
		}
		const ref: BronRef =
			c.kind === 'ecli'
				? { collection: 'judgments', key: nodeKey(c.ecli) }
				: { collection: 'instruments', key: nodeKey(c.id) };
		return (await deps.exists(ref)) ? { ref, at: null } : null;
	} catch {
		return null;
	}
}

/**
 * The law an abbreviation stands for ("AVG" → Verordening (EU) 2016/679), as `/api/resolve`
 * knows it (API 0.70: the curated abbreviations), or null.
 */
export async function resolveLaw(
	query: string,
	deps: Pick<ResolveDeps, 'resolve'> = apiDeps
): Promise<Resolved | null> {
	const found = await deps.resolve(query).catch(() => null);
	return found?.ref.collection === 'instruments' ? found : null;
}
