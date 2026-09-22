import { api, unwrap } from '$lib/api/client';
import type { GraphNode } from '$lib/graph/types';

// The reader and the panel Verbonden of one bron mount together and ask for the same lists.
const inflight = new Map<string, Promise<unknown>>();

function shared<T>(id: string, load: () => Promise<T>): Promise<T> {
	let request = inflight.get(id) as Promise<T> | undefined;
	if (!request) {
		request = load().finally(() => inflight.delete(id));
		inflight.set(id, request);
	}
	return request;
}

/** The API addresses a dossier as `29684` or `29684-I`; a node key is `29684_i`. */
export const dossierNumber = (key: string) => key.replace('_', '-').toUpperCase();

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
