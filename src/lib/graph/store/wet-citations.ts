import { api, unwrap } from '$lib/api/client';
import { recordInstrument } from '$lib/api/instrument-cache';
import { getLawIdFromProps } from '$lib/util/law-id';
import { isCollection } from '$lib/vocabulary';
import { relationOf, syntheticNode } from '../types';
import type { GraphContext } from './context';
import { inDisc, place } from './layout';
import type { GraphStore } from './types';

// The API answers a node with `{id, key, collection, props}`, grouped by collection.
type SideNode = { key: string; props?: Record<string, unknown> | null };

// The laws of the long tail (in a live wet 150 of 175 contribute one to four
// articles) would cost a ring of space and show no structure. Only laws that
// cite in numbers get a disc; the article-per-law counts are in the index.
const MIN_ARTICLES_PER_LAW = 5;
const DISC_GAP = 80;
const FOCAL_MARGIN = 140;

export function createWetCitations(ctx: GraphContext): Pick<GraphStore, 'loadInstrumentCitations'> {
	const { nodes, touchNode, addEdge, emit, run, signal } = ctx;

	/** Discs of articles, one per foreign law, on a ring around the wet on the canvas. */
	function layOutForeignArticles(articles: SideNode[]) {
		const byLaw = Map.groupBy(articles, (a) => getLawIdFromProps(a.props ?? {}, a.key) ?? '');
		const discs = [...byLaw.values()]
			.filter((members) => members.length >= MIN_ARTICLES_PER_LAW)
			.sort((a, b) => b.length - a.length)
			.map((members) => ({ members, radius: Math.max(34, Math.sqrt(members.length) * 9) }));

		let focalExtent = 0;
		for (const n of nodes.values()) {
			if (n.kind === 'article') focalExtent = Math.max(focalExtent, Math.hypot(n.x ?? 0, n.y ?? 0));
		}
		focalExtent ||= 500;

		// The ring holds every disc with a gap and clears the wet; any surplus is
		// shared out as extra gap so the discs spread over the full circle.
		const diameters = discs.reduce((sum, d) => sum + 2 * d.radius, 0);
		const widest = Math.max(0, ...discs.map((d) => d.radius));
		const ringRadius = Math.max(
			focalExtent + FOCAL_MARGIN + widest,
			(diameters + DISC_GAP * discs.length) / (2 * Math.PI)
		);
		const gap = discs.length > 0 ? (2 * Math.PI * ringRadius - diameters) / discs.length : 0;

		const positions = new Map<string, { x: number; y: number }>();
		let angle = -Math.PI / 2;
		for (const { members, radius } of discs) {
			const arc = (2 * radius + gap) / ringRadius;
			const center = {
				x: Math.cos(angle + arc / 2) * ringRadius,
				y: Math.sin(angle + arc / 2) * ringRadius
			};
			members.forEach((a, i) => positions.set(a.key, inDisc(i, members.length, radius, center)));
			angle += arc;
		}
		return positions;
	}

	return {
		loadInstrumentCitations: async (bwbId, opts) => {
			const requestSignal = signal();
			return run(requestSignal, async () => {
				const resp = await unwrap(
					api.GET('/api/instruments/{bwb_id}/citations', {
						params: {
							path: { bwb_id: bwbId },
							query: { relations: opts?.relations?.join(','), max_edges: opts?.maxEdges }
						},
						signal: requestSignal
					})
				);

				const positions = layOutForeignArticles((resp.nodes.articles ?? []) as SideNode[]);

				let added = 0;
				const add = (collection: string, n: SideNode, position?: { x: number; y: number }) => {
					if (!isCollection(collection)) return;
					const id = `${collection}/${n.key}`;
					if (nodes.has(id)) return;
					const name = n.props?.display_name;
					const node = syntheticNode(
						collection,
						n.key,
						typeof name === 'string' ? name : null,
						n.props ?? {}
					);
					touchNode(id, position ? place(node, position.x, position.y) : node);
					added++;
				};

				for (const [collection, list] of Object.entries(resp.nodes)) {
					if (opts?.collections && !opts.collections.some((c) => c === collection)) continue;
					for (const n of list as SideNode[]) {
						const p = n.props ?? {};
						if (collection === 'instruments') {
							recordInstrument({ key: n.key, ...p });
						} else if (collection === 'articles') {
							if (p.bwb_id) recordInstrument({ bwb_id: p.bwb_id, short_title: p.short_title });
							// An article of a law that does not get a disc stays off the canvas.
							const position = positions.get(n.key);
							if (position) add(collection, n, position);
							continue;
						}
						add(collection, n);
					}
				}

				for (const e of resp.edges) {
					const relation = relationOf(e.relation);
					if (relation && nodes.has(e.from) && nodes.has(e.to)) {
						addEdge(e.from, e.to, relation, { meta: e.meta });
					}
				}

				// Not placed as an additive layer: the discs have their own layout.
				emit();
				return { count: added };
			});
		}
	};
}
