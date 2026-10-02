import { api, unwrap } from '$lib/api/client';
import { once } from '$lib/api/records';
import type { GraphNode } from '$lib/graph/types';

// The reader and the panel Verbonden of one bron ask for the same lists: asked once ($lib/api/records).
const shared = once;

export const getDossier = (number: string) =>
	shared(`dossier/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}', { params: { path: { number } } }))
	);

export const getDossierDocuments = (number: string) =>
	shared(`documents/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}/documents', { params: { path: { number } } }))
	);

export const getDossierMutations = (number: string) =>
	shared(`mutations/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}/mutations', { params: { path: { number } } }))
	);

/** The votes of a member's reader; one request serves every mount of the same key. */
export const getMemberVotes = (key: string) =>
	shared(`votes/${key}`, () =>
		unwrap(api.GET('/api/members/{key}/votes', { params: { path: { key }, query: { limit: 50 } } }))
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
