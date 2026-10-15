import { nodeId } from '$lib/vocabulary';
import { get } from 'svelte/store';
import { containerIdFor, containerKindOf } from '../container-membership';
import { syntheticNode } from '../types';
import type { GraphContext } from './context';
import { placeConnection } from './placement';
import type { GraphStore } from './types';

export function createViewActions(
	ctx: GraphContext
): Pick<
	GraphStore,
	| 'setSelection'
	| 'focusNode'
	| 'showRows'
	| 'hideRows'
	| 'reset'
	| 'setFilters'
	| 'getNodeById'
	| 'getEdgeById'
	| 'pruneNodes'
	| 'sweepOrphans'
> {
	const {
		nodes,
		edges,
		pinned,
		containers,
		selectionStore,
		filtersStore,
		addEdge,
		endOf,
		threshold,
		emit,
		focusInternal,
		pruneToIds,
		removeNodes,
		touchNode,
		reset
	} = ctx;

	return {
		setSelection: (nodeId) => {
			if (nodeId) focusInternal(nodeId);
			else selectionStore.set(null);
		},
		focusNode: (nodeId) => focusInternal(nodeId),

		showRows: (focusId, rows) => {
			const focus = nodes.get(focusId);
			if (!focus) return false;
			// A cabinet, commissie, fractie, dossier or wet holds its members in its hull, as a
			// node response does: no verbinding drawn out of it (Kabinet-Jetten, 10 Oct: five
			// bewindspersonen hung outside the hull after Ongedaan maken).
			const near = endOf(focus.raw?.collection ?? '', focus);
			for (const row of rows) {
				const id = nodeId(row.ref.collection, row.ref.key);
				if (!nodes.has(id))
					touchNode(id, syntheticNode(row.ref.collection, row.ref.key, row.title, row.props ?? {}));
				const node = nodes.get(id)!;
				const far = endOf(node.raw?.collection ?? '', node);
				const inbound = row.direction === 'inbound';
				const placement = placeConnection({
					mode: 'rows',
					relation: row.relation,
					source: inbound ? far : near,
					target: inbound ? near : far,
					focus: inbound ? 'target' : 'source',
					threshold: threshold()
				});
				const [source, target] = inbound ? [node, focus] : [focus, node];
				if (placement.place === 'member') {
					const [hull, member] = placement.hull === 'source' ? [source, target] : [target, source];
					containers.recordMember(
						containerKindOf(hull.raw!.collection)!,
						containerIdFor(hull.raw!),
						member.id,
						row.relation,
						placement.seat ? (row.period ?? null) : null
					);
				} else if (placement.place === 'line') {
					addEdge(source.id, target.id, row.relation, {
						status: row.proposed ? 'voorgesteld' : null
					});
				}
			}
			emit();
			return true;
		},
		hideRows: (ids) => {
			const selectedId = get(selectionStore)?.id;
			removeNodes(ids.filter((id) => id !== selectedId && !pinned.has(id)));
			emit();
		},

		reset,

		setFilters: (updater) => {
			const current = get(filtersStore);
			filtersStore.set({ ...current, ...updater });
		},

		getNodeById: (nodeId) => nodes.get(nodeId),
		getEdgeById: (edgeId) => edges.get(edgeId),

		pruneNodes: (keepIds) => {
			pruneToIds(keepIds);
			emit();
		},

		sweepOrphans: () => {
			const connected = new Set<string>();
			for (const e of edges.values()) {
				connected.add(e.source);
				connected.add(e.target);
			}
			const selectedId = get(selectionStore)?.id;
			const orphans = [...nodes.keys()].filter(
				(id) => !connected.has(id) && !pinned.has(id) && id !== selectedId && !containers.holds(id)
			);
			removeNodes(orphans);
			if (orphans.length > 0) emit();
		}
	};
}
