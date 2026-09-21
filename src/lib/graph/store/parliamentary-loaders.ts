import { api, unwrap } from '$lib/api/client';
import { getNodeGraph } from '$lib/api/nodes';
import type { Schema } from '$lib/api/types';
import {
	committeeToGraphNode,
	dossierToGraphNode,
	factionToGraphNode,
	memberToGraphNode,
	syntheticNode
} from '../types';
import type { GraphContext } from './context';
import { onCircle, place } from './layout';
import { HUB_NEIGHBOR_LIMIT, type GraphStore } from './types';

// Documents shown around each of the first open dossiers of the recent-dossiers layer.
const HALO_DOSSIERS = 25;
const HALO_DOCUMENTS = 8;
const RECENT_DOSSIERS = 80;

const LOADING = { kind: 'parliamentary', phase: 'fetching' } as const;

export function createParliamentaryLoaders(
	ctx: GraphContext
): Pick<
	GraphStore,
	| 'loadMemberGraph'
	| 'loadFactionGraph'
	| 'loadCommitteesLayerGraph'
	| 'loadMembersLayerGraph'
	| 'loadFactionsLayerGraph'
	| 'loadRecentDossiersGraph'
> {
	const {
		nodes,
		cache,
		touchNode,
		addEdge,
		prepareBulkLoad,
		finishBulk,
		mergeResponse,
		run,
		signal,
		supersede,
		state
	} = ctx;

	/** One member or faction in the middle with its neighbours around it. */
	const loadHub = (collection: 'members' | 'factions', key: string) => {
		const requestSignal = supersede();
		return run(
			requestSignal,
			async () => {
				const graph = await getNodeGraph(collection, key, {
					neighborLimit: HUB_NEIGHBOR_LIMIT,
					signal: requestSignal
				});
				prepareBulkLoad(false);
				cache.set(graph.node.id, graph);
				const hub = nodes.get(mergeResponse(graph) ?? '');
				if (hub) place(hub, 0, 0, 14);
				finishBulk(false, 0, hub);
				return { count: nodes.size };
			},
			LOADING
		);
	};

	/** Puts `members` on a circle around `center` and connects each to `hub`. */
	const addHalo = (
		hubId: string,
		members: Schema<'MemberDTO'>[],
		center: { x: number; y: number },
		additive: boolean
	) => {
		const radius = 22 + Math.sqrt(members.length) * 8;
		members.forEach((m, i) => {
			const member = memberToGraphNode(m);
			// A member on several committees keeps the position from the first.
			if (!nodes.has(member.id)) {
				if (!additive) {
					const { x, y } = onCircle(i, members.length, radius, center);
					place(member, x, y, m.active ? 5 : 3.5);
				}
				touchNode(member.id, member);
			}
			addEdge(member.id, hubId, 'MEMBER_OF');
		});
	};

	return {
		loadMemberGraph: (key) => loadHub('members', key),
		loadFactionGraph: (key) => loadHub('factions', key),

		loadCommitteesLayerGraph: async (opts) => {
			const additive = opts?.additive ?? false;
			const requestSignal = additive ? signal() : supersede();
			return run(
				requestSignal,
				async () => {
					// One request for every committee with its members, not one per committee.
					const list = await unwrap(
						api.GET('/api/committees/with-members', { signal: requestSignal })
					);
					prepareBulkLoad(additive);
					const seqBefore = state.seq;

					// The committees with most open dossiers first, drawn larger.
					const sorted = [...list].sort(
						(a, b) => (b.active_dossier_count ?? 0) - (a.active_dossier_count ?? 0)
					);
					const maxCount = Math.max(1, sorted[0]?.active_dossier_count ?? 0);
					const ringRadius = Math.max(180, sorted.length * 38);
					sorted.forEach(({ members, ...committee }, i) => {
						const node = committeeToGraphNode(committee);
						const center = onCircle(i, sorted.length, ringRadius);
						if (!additive) {
							const size = 6 + ((committee.active_dossier_count ?? 0) / maxCount) * 10;
							place(node, center.x, center.y, size);
						}
						touchNode(node.id, node);
						addHalo(node.id, members ?? [], center, additive);
					});
					finishBulk(additive, seqBefore);
					return { count: nodes.size };
				},
				LOADING
			);
		},

		loadMembersLayerGraph: async (opts) => {
			const additive = opts?.additive ?? false;
			const requestSignal = additive ? signal() : supersede();
			return run(
				requestSignal,
				async () => {
					const list = await unwrap(
						api.GET('/api/members', { params: { query: { active: true } }, signal: requestSignal })
					);
					if (list.length === 0) return null;
					prepareBulkLoad(additive);
					const seqBefore = state.seq;

					// A party after another keeps its members together on the circle.
					const sorted = [...list].sort(
						(a, b) =>
							(a.party ?? '').localeCompare(b.party ?? '', 'nl') ||
							(a.name ?? '').localeCompare(b.name ?? '', 'nl')
					);
					const radius = Math.max(120, sorted.length * 4);
					sorted.forEach((m, i) => {
						const node = memberToGraphNode(m);
						if (!additive) {
							const { x, y } = onCircle(i, sorted.length, radius);
							place(node, x, y, 5);
						}
						touchNode(node.id, node);
					});
					finishBulk(additive, seqBefore);
					return { count: nodes.size };
				},
				LOADING
			);
		},

		loadFactionsLayerGraph: async (opts) => {
			const additive = opts?.additive ?? false;
			const requestSignal = additive ? signal() : supersede();
			return run(
				requestSignal,
				async () => {
					const query = { active: true };
					const [factions, members] = await Promise.all([
						unwrap(api.GET('/api/factions', { params: { query }, signal: requestSignal })),
						unwrap(api.GET('/api/members', { params: { query }, signal: requestSignal }))
					]);
					if (factions.length === 0) return null;
					prepareBulkLoad(additive);
					const seqBefore = state.seq;

					const membersOf = Map.groupBy(
						members,
						(m) => m.faction_memberships?.find((f) => !f.to_date)?.faction_key
					);
					// The factions with most seats first, drawn larger; their members around them.
					const sorted = [...factions].sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0));
					const maxSeats = Math.max(1, sorted[0]?.seats ?? 0);
					const ringRadius = Math.max(180, sorted.length * 38);
					sorted.forEach((f, i) => {
						const node = factionToGraphNode(f);
						const center = onCircle(i, sorted.length, ringRadius);
						if (!additive) {
							place(node, center.x, center.y, 6 + ((f.seats ?? 0) / maxSeats) * 10);
						}
						touchNode(node.id, node);
						addHalo(node.id, membersOf.get(f.key) ?? [], center, additive);
					});
					finishBulk(additive, seqBefore);
					return { count: nodes.size };
				},
				LOADING
			);
		},

		loadRecentDossiersGraph: async (opts) => {
			const additive = opts?.additive ?? false;
			const requestSignal = additive ? signal() : supersede();
			return run(
				requestSignal,
				async () => {
					const dossiers = await unwrap(
						api.GET('/api/dossiers/recent', {
							params: { query: { days: opts?.days ?? 30, limit: RECENT_DOSSIERS } },
							signal: requestSignal
						})
					);
					const open = dossiers.filter((d) => !d.closed);
					const closed = dossiers.filter((d) => d.closed);

					// The documents of the first open dossiers, in one request. Without
					// them the dossiers are still worth showing.
					const halos = open.slice(0, HALO_DOSSIERS);
					const documents =
						halos.length === 0
							? null
							: await unwrap(
									api.GET('/api/dossiers/documents/bulk', {
										params: {
											query: {
												numbers: halos.map((d) => d.number).join(','),
												per_dossier_limit: HALO_DOCUMENTS
											}
										},
										signal: requestSignal
									})
								).catch(() => null);
					requestSignal.throwIfAborted();

					prepareBulkLoad(additive);
					const seqBefore = state.seq;

					// Open dossiers on the inner ring, closed ones outside it.
					const innerRadius = Math.max(180, open.length * 18);
					const outerRadius = innerRadius + Math.max(60, closed.length * 6);
					const placeRing = (ring: typeof dossiers, radius: number) =>
						ring.forEach((d, i) => {
							const node = dossierToGraphNode(d);
							const center = onCircle(i, ring.length, radius);
							if (!additive) place(node, center.x, center.y, d.closed ? 5 : 8);
							touchNode(node.id, node);

							const docs = documents?.items[d.number] ?? [];
							const haloRadius = 18 + Math.sqrt(docs.length) * 6;
							docs.forEach((doc, j) => {
								const docNode = syntheticNode(
									'documents',
									doc.key,
									doc.display_name ?? doc.title ?? doc.kind ?? null,
									{
										kind: doc.kind,
										title: doc.title,
										date: doc.date,
										sequence: doc.sequence,
										session_year: doc.session_year,
										tk_url: doc.tk_url
									}
								);
								if (!nodes.has(docNode.id)) {
									if (!additive) {
										const { x, y } = onCircle(j, docs.length, haloRadius, center);
										place(docNode, x, y, 4.5);
									}
									touchNode(docNode.id, docNode);
								}
								addEdge(docNode.id, node.id, 'PART_OF');
							});
						});
					placeRing(open, innerRadius);
					placeRing(closed, outerRadius);

					finishBulk(additive, seqBefore);
					return { count: nodes.size };
				},
				LOADING
			);
		}
	};
}
