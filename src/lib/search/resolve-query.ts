// `GET /api/resolve` (API 0.5) turns a citation into one bron. `resolveQuery` asks it
// first and, where it is absent or finds nothing, parses the notation itself.
// TODO(backend B11): the parser and the lookups below go when every notation resolves.
import { api, unwrap } from '$lib/api/client';
import type { BronRef } from '$lib/bron/href';
import type { Collection } from '$lib/vocabulary';
import { anchorOf, parseQualifier } from '$lib/text/qualifier';

export type Citation =
	| { kind: 'ecli'; ecli: string }
	| { kind: 'article'; number: string; law: string; book: string | null; at: string | null }
	| { kind: 'dossier'; number: string; document: string | null }
	| { kind: 'bwb'; id: string }
	| { kind: 'celex'; id: string };

export type Resolved = { ref: BronRef; at: string | null };

const ECLI = /^ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]+$/i;
const BWB = /^BWB[RVW]\d{7}$/i;
const CELEX = /^[0-9CE]\d{4}[A-Z]{1,2}\d{4}(?:R\(\d+\))?$/i;
const DOSSIER =
	/^(?:kamerstuk(?:ken)?\s+(?:I{1,2}\s+)?)?(\d{5}(?:-[IVXLC]+|-\(R\d+\))?)(?:\s*(?:-|,?\s*nr\.?)\s*(\d+|[A-Z]{1,2}))?$/i;
// "artikel 287 Sr", "art. 6:162 BW", "art. 359a lid 1 onder b Sv", "artikel 3:4, tweede lid, Awb".
const ARTICLE = /^art(?:ikel|\.)?\s*(?:(\d+[a-z]?):)?(\d+[a-z]*(?:\.\d+[a-z]*)*)(?![\w:])(.*)$/i;
// What stands between the article number and the law: ", tweede lid,", "lid 1 onder b".
const QUALIFIER =
	/,?\s*(?:(?:[a-z]+de|[a-z]+ste)(?:\s+en\s+[a-z]+(?:de|ste))?\s+lid|lid\s+\d+[a-z]?|aanhef(?:\s+en)?|(?:onderdeel|onder|sub)\s+(?:\d+\s*°?|[a-z]{1,2})(?![a-z]))\s*,?/gi;

/** The boeken of the Burgerlijk Wetboek are instruments of their own. */
const BW_BOOKS: Record<string, string> = {
	'1': 'BWBR0002656',
	'2': 'BWBR0003045',
	'3': 'BWBR0005291',
	'4': 'BWBR0002761',
	'5': 'BWBR0005288',
	'6': 'BWBR0005289',
	'7': 'BWBR0005290',
	'7a': 'BWBR0006000',
	'8': 'BWBR0005034',
	'10': 'BWBR0030068'
};
const isBW = (law: string) => /^(bw|burgerlijk wetboek)$/i.test(law.trim());

/** The citation a query is, or null when it is words to search for. */
export function parseCitation(query: string): Citation | null {
	const q = query.trim().replace(/\s+/g, ' ');
	if (!q) return null;
	if (ECLI.test(q)) return { kind: 'ecli', ecli: q.toUpperCase() };
	if (BWB.test(q)) return { kind: 'bwb', id: q.toUpperCase() };
	if (CELEX.test(q)) return { kind: 'celex', id: q.toUpperCase() };
	const dossier = DOSSIER.exec(q);
	if (dossier) {
		return { kind: 'dossier', number: dossier[1].toUpperCase(), document: dossier[2] ?? null };
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
	exists: (ref: BronRef) => Promise<boolean>;
};

const RESOLVE_KINDS: Record<string, Collection> = {
	article: 'articles',
	instrument: 'instruments',
	judgment: 'judgments',
	dossier: 'dossiers',
	document: 'documents'
};

const apiDeps: ResolveDeps = {
	resolve: async (q) => {
		const { data, response } = await api.GET('/api/resolve', { params: { query: { q } } });
		const match = response.ok ? data?.match : null;
		const collection = match && (RESOLVE_KINDS[match.kind] ?? null);
		if (!match || !collection) return null;
		return {
			ref: { collection, key: match.key },
			at: anchorOf(parseQualifier(data?.qualifier ?? ''))
		};
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
	articleKey: async (bwbId, articleNumber) => {
		const { data } = await api.GET('/api/articles/{bwb_id}/{article_number}', {
			params: { path: { bwb_id: bwbId, article_number: articleNumber } }
		});
		return data?.article.key ?? null;
	},
	documentKey: async (dossier, nr) => {
		const { data } = await api.GET('/api/dossiers/{number}/documents', {
			params: { path: { number: dossier } }
		});
		const wanted = nr.toLowerCase();
		const hit = data?.items.find(
			(d) => String(d.sequence ?? '') === wanted || d.key.toLowerCase().endsWith(`_${wanted}`)
		);
		return hit?.key ?? null;
	},
	exists: async ({ collection, key }) => {
		const { response } = await api.GET('/api/nodes/{collection}/{key}', {
			params: { path: { collection, key }, query: { limit: 1 } }
		});
		return response.ok;
	}
};

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
		const resolved = await deps.resolve(query).catch(() => null);
		if (resolved) return resolved;
		if (c.kind === 'article') {
			const bwb = c.book ? BW_BOOKS[c.book] : await deps.lawId(c.law, c.number);
			const key = bwb ? await deps.articleKey(bwb, c.number) : null;
			return key ? { ref: { collection: 'articles', key }, at: c.at } : null;
		}
		if (c.kind === 'dossier' && c.document) {
			const key = await deps.documentKey(c.number, c.document);
			if (key) return { ref: { collection: 'documents', key }, at: null };
		}
		const ref: BronRef =
			c.kind === 'ecli'
				? { collection: 'judgments', key: nodeKey(c.ecli) }
				: c.kind === 'dossier'
					? { collection: 'dossiers', key: nodeKey(c.number) }
					: { collection: 'instruments', key: nodeKey(c.id) };
		return (await deps.exists(ref)) ? { ref, at: null } : null;
	} catch {
		return null;
	}
}
