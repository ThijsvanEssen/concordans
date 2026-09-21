import { api, unwrap } from '$lib/api/client';
import { recordInstrument } from '$lib/api/instrument-cache';
import type { Schema } from '$lib/api/types';
import { relationOf, syntheticNode } from '../types';
import type { GraphContext } from './context';
import { onCircle, place } from './layout';
import type { GraphStore } from './types';

type LayerInstrument = Schema<'InstrumentLayerInstrumentDTO'>;
type LayerEdge = Schema<'InstrumentEdgeDTO'>;

/** Instruments of a layer answer with their names in fields of their own; the node keeps them as props. */
function instrumentNode(i: LayerInstrument) {
	recordInstrument(i);
	return syntheticNode(
		'instruments',
		i.key,
		i.display_name ?? i.citation_title ?? i.title ?? null,
		{
			bwb_id: i.bwb_id,
			citation_title: i.citation_title,
			title: i.title,
			stub: i.stub
		}
	);
}

/** Per node id, the sum of the weights of the edges that touch it. */
function degrees(edges: LayerEdge[], weighted: boolean) {
	const degree = new Map<string, number>();
	for (const e of edges) {
		const weight = weighted ? (e.weight ?? 1) : 1;
		degree.set(e.from_id, (degree.get(e.from_id) ?? 0) + weight);
		degree.set(e.to_id, (degree.get(e.to_id) ?? 0) + weight);
	}
	return degree;
}

export function createGlobalLoaders(
	ctx: GraphContext
): Pick<GraphStore, 'loadInstrumentLayerGraph' | 'loadJudgmentLayerGraph'> {
	const { nodes, touchNode, addEdge, prepareBulkLoad, finishBulk, run, signal, supersede, state } =
		ctx;

	/** Adds the edges of a layer whose two ends are on the canvas. */
	const addLayerEdges = (edges: LayerEdge[]) => {
		for (const e of edges) {
			const relation = relationOf(e.relation_type);
			if (relation && nodes.has(e.from_id) && nodes.has(e.to_id)) {
				addEdge(e.from_id, e.to_id, relation, { confidence: e.confidence });
			}
		}
	};

	return {
		loadInstrumentLayerGraph: async (opts) => {
			const additive = opts?.additive ?? false;
			const requestSignal = additive ? signal() : supersede();
			return run(
				requestSignal,
				async () => {
					// No parameter narrows this answer (28 MB). Three in four instruments
					// (mostly amending publications) have no edge and are left out here.
					const { instruments, edges } = await unwrap(
						api.GET('/api/graph/instruments', { signal: requestSignal })
					);
					const degree = degrees(edges, false);
					const connected = instruments
						.filter((i) => degree.has(i.id))
						.sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));

					// Concentric rings by degree: the hubs (Awb, Sr) in the middle, the
					// rest outside. A ring is as wide as its nodes need, and a hub is drawn larger.
					const maxDegree = Math.max(1, ...degree.values());
					const MIN_SPACING = 24;
					const RING_GAP = 70;
					const rings: { members: LayerInstrument[]; radius: number }[] = [];
					let radius = 0;
					let from = 0;
					for (const cumulative of [0.07, 0.2, 0.45, 1]) {
						const to = Math.ceil(connected.length * cumulative);
						const members = connected.slice(from, to);
						if (members.length === 0) break;
						radius = Math.max(radius + RING_GAP, (members.length * MIN_SPACING) / (2 * Math.PI));
						rings.push({ members, radius });
						from = to;
					}

					prepareBulkLoad(additive);
					const seqBefore = state.seq;
					for (const { members, radius } of rings) {
						members.forEach((instrument, i) => {
							const node = instrumentNode(instrument);
							if (!additive) {
								const { x, y } = onCircle(i, members.length, radius);
								place(node, x, y, 3 + ((degree.get(instrument.id) ?? 0) / maxDegree) * 10);
							}
							touchNode(node.id, node);
						});
					}
					addLayerEdges(edges);
					finishBulk(additive, seqBefore);
					return { count: nodes.size };
				},
				{ kind: 'global', phase: 'fetching' }
			);
		},

		loadJudgmentLayerGraph: async (opts) => {
			const additive = opts?.additive ?? false;
			const requestSignal = additive ? signal() : supersede();
			return run(
				requestSignal,
				async () => {
					const { judgments, instruments, edges } = await unwrap(
						api.GET('/api/graph/judgments', { signal: requestSignal })
					);
					const degree = degrees(edges, true);
					const maxDegree = Math.max(1, ...degree.values());

					// The instruments the judgments cite are the anchors on the outer
					// ring; the judgments start on a tighter one.
					const anchorRadius = Math.max(200, instruments.length * 22);
					const judgmentRadius = Math.max(80, Math.sqrt(judgments.length) * 18);

					prepareBulkLoad(additive);
					const seqBefore = state.seq;
					instruments.forEach((instrument, i) => {
						const node = instrumentNode(instrument);
						if (!additive) {
							const { x, y } = onCircle(i, instruments.length, anchorRadius);
							place(node, x, y, 4 + ((degree.get(instrument.id) ?? 0) / maxDegree) * 9);
						}
						touchNode(node.id, node);
					});
					judgments.forEach((j, i) => {
						const node = syntheticNode('judgments', j.key, j.display_name ?? null, {
							ecli: j.ecli,
							stub: j.stub
						});
						if (!additive) {
							// The radius varies so the judgments do not all sit on one line.
							const { x, y } = onCircle(i, judgments.length, judgmentRadius + ((i * 37) % 60) - 30);
							place(node, x, y, 2 + ((degree.get(j.id) ?? 0) / maxDegree) * 6);
						}
						touchNode(node.id, node);
					});
					addLayerEdges(edges);
					finishBulk(additive, seqBefore);
					return { count: nodes.size };
				},
				{ kind: 'global', phase: 'fetching' }
			);
		}
	};
}
