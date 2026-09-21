import { api, unwrap } from '$lib/api/client';
import { ensureInstrumentMeta, getInstrumentMeta } from '$lib/api/instrument-cache';
import { nodeId } from '$lib/vocabulary';
import { syntheticNode } from '../types';
import type { GraphContext } from './context';
import { inDisc, place } from './layout';
import type { GraphStore } from './types';

// Requests of the layer buttons. The API takes `limit` up to 2000.
const JUDGMENT_LIMIT = 1000;
const DOSSIER_LIMIT = 500;

export function createWetLoaders(
	ctx: GraphContext
): Pick<
	GraphStore,
	| 'loadInstrument'
	| 'prefetchInstrumentLayerCounts'
	| 'loadInstrumentJudgmentsLayer'
	| 'loadInstrumentDossiersLayer'
> {
	const {
		nodes,
		wetLayerTotals,
		currentInstrumentBwbStore,
		recomputePotentialCounts,
		touchNode,
		addEdge,
		prepareBulkLoad,
		finishBulk,
		run,
		signal,
		supersede,
		state
	} = ctx;

	return {
		loadInstrument: async (bwbId) => {
			const requestSignal = supersede();
			return run(
				requestSignal,
				async () => {
					const { items } = await unwrap(
						api.GET('/api/instruments/{bwb_id}/articles', {
							params: { path: { bwb_id: bwbId }, query: { text_preview_chars: 0 } },
							signal: requestSignal
						})
					);
					// The caller falls back to expanding the node, which needs the canvas as it is.
					if (items.length === 0) return null;

					// One arc of a ring per top-level part of the law (boek, titel); the
					// articles of a part fill a disc on it, the largest part at the top.
					const parts = Map.groupBy(items, (a) => a.breadcrumb?.[0]?.label ?? '');
					const ordered = [...parts.values()].sort((a, b) => b.length - a.length);
					const ringRadius = Math.max(240, Math.sqrt(items.length) * 14);

					prepareBulkLoad(false);
					currentInstrumentBwbStore.set(bwbId);
					let arcStart = -Math.PI / 2;
					for (const part of ordered) {
						const arc = (part.length / items.length) * Math.PI * 2;
						const angle = arcStart + arc / 2;
						const center = { x: Math.cos(angle) * ringRadius, y: Math.sin(angle) * ringRadius };
						const discRadius = 12 + Math.sqrt(part.length) * 3.5;
						part.forEach((a, i) => {
							const node = syntheticNode('articles', a.key, a.display_name, {
								bwb_id: a.bwb_id,
								article_number: a.article_number,
								breadcrumb: a.breadcrumb,
								stub: a.stub
							});
							const { x, y } = inDisc(i, part.length, discRadius, center);
							nodes.set(node.id, place(node, x, y));
						});
						arcStart += arc;
					}

					// The short title ("Sr") is on the instrument only.
					ensureInstrumentMeta(bwbId);
					finishBulk(false, 0);
					return { count: nodes.size };
				},
				{ kind: 'instrument', bwbId, phase: 'fetching' }
			);
		},

		prefetchInstrumentLayerCounts: async (bwbId) => {
			const params = { path: { bwb_id: bwbId }, query: { limit: 1 } };
			const requestSignal = signal();
			try {
				const [judgments, dossiers] = await Promise.all([
					unwrap(api.GET('/api/instruments/{bwb_id}/judgments', { params, signal: requestSignal })),
					unwrap(api.GET('/api/instruments/{bwb_id}/dossiers', { params, signal: requestSignal }))
				]);
				wetLayerTotals['judgment'] = judgments.total;
				wetLayerTotals['dossier'] = dossiers.total;
				recomputePotentialCounts();
			} catch {
				// The badges stay empty.
			}
		},

		loadInstrumentJudgmentsLayer: async (bwbId) => {
			const requestSignal = signal();
			return run(requestSignal, async () => {
				const { items } = await unwrap(
					api.GET('/api/instruments/{bwb_id}/judgments', {
						params: { path: { bwb_id: bwbId }, query: { limit: JUDGMENT_LIMIT } },
						signal: requestSignal
					})
				);
				const seqBefore = state.seq;
				let added = 0;
				for (const j of items) {
					const judgment = syntheticNode('judgments', j.key, j.display_name ?? null, {
						ecli: j.ecli
					});
					if (!nodes.has(judgment.id)) {
						touchNode(judgment.id, judgment);
						added++;
					}
					// The cited articles that are on the canvas; others are not fetched here.
					for (const a of j.cited_articles ?? []) {
						if (nodes.has(a.id)) addEdge(judgment.id, a.id, 'REFERS_TO');
					}
				}
				finishBulk(true, seqBefore);
				return { count: added };
			});
		},

		loadInstrumentDossiersLayer: async (bwbId) => {
			const requestSignal = signal();
			return run(requestSignal, async () => {
				const { items } = await unwrap(
					api.GET('/api/instruments/{bwb_id}/dossiers', {
						params: { path: { bwb_id: bwbId }, query: { limit: DOSSIER_LIMIT } },
						signal: requestSignal
					})
				);
				const seqBefore = state.seq;

				// The API names the dossier a wet was legislated in, not the articles
				// the dossier touches, so the dossiers connect to the wet itself.
				const instrumentKey = bwbId.toLowerCase();
				const instrument = nodeId('instruments', instrumentKey);
				if (items.length > 0 && !nodes.has(instrument)) {
					const name = getInstrumentMeta(bwbId)?.citationTitle ?? bwbId;
					touchNode(
						instrument,
						syntheticNode('instruments', instrumentKey, name, { bwb_id: bwbId })
					);
				}

				let added = 0;
				for (const d of items) {
					const dossier = syntheticNode('dossiers', d.key, d.title ?? d.dossier_number ?? null, {
						number: d.dossier_number,
						title: d.title,
						current_stage: d.stage,
						closed: d.closed,
						opened_on: d.opened_on
					});
					if (!nodes.has(dossier.id)) {
						touchNode(dossier.id, dossier);
						added++;
					}
					addEdge(instrument, dossier.id, 'LEGISLATED_IN');
				}
				finishBulk(true, seqBefore);
				return { count: added };
			});
		}
	};
}
