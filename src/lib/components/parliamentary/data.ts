import { textOf } from '$lib/text/words';
import { api, unwrap, zoekApi } from '$lib/api/client';
import { once } from '$lib/api/records';
import type { GraphNode } from '$lib/graph/types';

// The reader and the panel Verbonden of one bron ask for the same lists: asked once ($lib/api/records).
export const getDossier = (number: string) =>
	once(`dossier/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}', { params: { path: { number } } }))
	);

/**
 * The node key of a dossier by its number (`37020-XV` → `37020_xv`), from the list: 0.2 s,
 * where the dossier's detail can take 5 s (36496 on prod, 9 Oct) and everything after it
 * waited. The detail where the list does not know the number.
 */
export const getDossierKey = (number: string) =>
	once(`dossier-key/${number}`, async () => {
		const found = await unwrap(
			api.GET('/api/dossiers', { params: { query: { number, limit: 5 } } })
		).catch(() => null);
		const exact = found?.items.find((d) => d.number?.toLowerCase() === number.toLowerCase());
		return exact?.key ?? (await getDossier(number)).key;
	});

export const getDossierMutations = (number: string) =>
	once(`mutations/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}/mutations', { params: { path: { number } } }))
	);

/** The votes of a member's reader; one request serves every mount of the same key. */
// A person's votes take the API seconds (8.8 to 10 s on prod, 9 Oct): they wait as long as the
// API does, not the 10 s of `api`, which cut them off.
export const getMemberVotes = (key: string) =>
	once(`votes/${key}`, () =>
		unwrap(
			zoekApi.GET('/api/members/{key}/votes', { params: { path: { key }, query: { limit: 50 } } })
		)
	);

/**
 * The votes a member cast while holding a post of the government (`in_office=true`, API
 * 0.79.44, #534), a page of 200 from `offset`; `next_offset` null after the last. No total:
 * the API does not count them (UX-toets 0.79.43, #29).
 */
export const getMemberVotesInOffice = (key: string, offset = 0) =>
	once(`votes/${key}/in-office/${offset}`, () =>
		unwrap(
			zoekApi.GET('/api/members/{key}/votes', {
				params: { path: { key }, query: { limit: 200, offset, in_office: true } }
			})
		)
	);

/** A committee is addressed by slug in `/api/committees/{slug}`; the node key is a GUID. */
export const committeeSlug = (node: GraphNode): string | null => textOf(node.raw?.props?.slug);

export const getCommittee = (slug: string) =>
	once(`committees/${slug}`, () =>
		unwrap(api.GET('/api/committees/{slug}', { params: { path: { slug } } }))
	);
