import { api, unwrap } from '$lib/api/client';
import type { Schema } from '$lib/api/types';
import { getNodeGraph } from '$lib/api/nodes';
import { relationOf, type GraphNode } from '$lib/graph/types';
import type { Collection } from '$lib/vocabulary';

// Reader, navigation and rail of one source mount together and ask for the same lists.
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

/** The most votes a member's reader, navigation and rail ask for; one request serves all three. */
export const getMemberVotes = (key: string) =>
	shared(`votes/${key}`, () =>
		unwrap(api.GET('/api/members/{key}/votes', { params: { path: { key }, query: { limit: 50 } } }))
	);

export const getNeighbors = (collection: Collection, key: string, neighborLimit: number) =>
	shared(
		`nodes/${collection}/${key}/${neighborLimit}`,
		async () => (await getNodeGraph(collection, key, { neighborLimit })).neighbors.all ?? []
	);

type Neighbor = Schema<'NeighborDTO'>;

/** The members linked to a faction, past and present. */
export const getFactionMembers = async (key: string): Promise<Neighbor[]> =>
	(await getNeighbors('factions', key, 100)).filter(
		(n) => n.collection === 'members' && n.relation === 'MEMBER_OF'
	);

/** Node props are untyped in the schema; this is a string prop, or null. */
export const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Whether the member belongs to the faction now; a member's own memberships are on the node. */
export const isCurrentMember = (member: Neighbor, factionKey: string): boolean =>
	((member.props?.faction_memberships ?? []) as Schema<'FactionMembershipDTO'>[]).some(
		(m) => m.faction_key === factionKey && !m.to_date
	);

/** A committee is addressed by slug in `/api/committees/{slug}`; the node key is a GUID. */
export const committeeSlug = (node: GraphNode): string | null => {
	return str(node.raw?.props?.slug) || null;
};

export const getCommittee = (slug: string) =>
	shared(`committees/${slug}`, () =>
		unwrap(api.GET('/api/committees/{slug}', { params: { path: { slug } } }))
	);

export type MutatedArticle = { key: string; label: string; relation: string | null };

const RELATION_LABEL: Partial<Record<string, string>> = {
	AMENDS: 'wijzigt',
	INTRODUCES: 'voegt toe',
	REPEALS: 'schrapt',
	REFERS_TO: 'verwijst naar',
	EXPLAINS: 'licht toe'
};

/** The articles a dossier's documents point at, once each, with the first relation found. */
export function mutatedArticles(mutations: Schema<'DossierMutationsResponse'>): MutatedArticle[] {
	const nodes = new Map(mutations.nodes.map((n) => [n.id, n]));
	const articles = new Map<string, MutatedArticle>();
	for (const { to_id, relation } of mutations.edges) {
		const target = to_id ? nodes.get(to_id) : undefined;
		if (target?.collection !== 'articles' || articles.has(target.id)) continue;
		const known = relationOf(relation);
		articles.set(target.id, {
			key: target.key,
			label: target.display_name ?? target.key,
			relation: known && (RELATION_LABEL[known] ?? null)
		});
	}
	return [...articles.values()];
}
