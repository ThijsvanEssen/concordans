import { api, unwrap, zoekApi } from '$lib/api/client';
import { once } from '$lib/api/records';
import type { GraphNode } from '$lib/graph/types';

// The reader and the panel Verbonden of one bron ask for the same lists: asked once ($lib/api/records).
const shared = once;

export const getDossier = (number: string) =>
	shared(`dossier/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}', { params: { path: { number } } }))
	);

/**
 * The node key of a dossier by its number (`37020-XV` → `37020_xv`), from the list: 0.2 s,
 * where the dossier's detail can take 5 s (36496 on prod, 9 Oct) and everything after it
 * waited. The detail where the list does not know the number.
 */
export const getDossierKey = (number: string) =>
	shared(`dossier-key/${number}`, async () => {
		const found = await unwrap(
			api.GET('/api/dossiers', { params: { query: { number, limit: 5 } } })
		).catch(() => null);
		const exact = found?.items.find((d) => d.number?.toLowerCase() === number.toLowerCase());
		return exact?.key ?? (await getDossier(number)).key;
	});

export const getDossierDocuments = (number: string) =>
	shared(`documents/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}/documents', { params: { path: { number } } }))
	);

export const getDossierMutations = (number: string) =>
	shared(`mutations/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}/mutations', { params: { path: { number } } }))
	);

/** The votes of a member's reader; one request serves every mount of the same key. */
// A person's votes take the API seconds (8.8 to 10 s on prod, 9 Oct): they wait as long as the
// API does, not the 10 s of `api`, which cut them off.
export const getMemberVotes = (key: string) =>
	shared(`votes/${key}`, () =>
		unwrap(
			zoekApi.GET('/api/members/{key}/votes', { params: { path: { key }, query: { limit: 50 } } })
		)
	);

/** Node props are untyped in the schema; this is a string prop, or null. */
export const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** A committee is addressed by slug in `/api/committees/{slug}`; the node key is a GUID. */
export const committeeSlug = (node: GraphNode): string | null => {
	return str(node.raw?.props?.slug) || null;
};

export const getCommittee = (slug: string) =>
	shared(`committees/${slug}`, () =>
		unwrap(api.GET('/api/committees/{slug}', { params: { path: { slug } } }))
	);
