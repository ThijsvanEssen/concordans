import { nodeId } from '$lib/vocabulary';
import { get } from 'svelte/store';
import { isContainerMember } from '../container-membership';
import { syntheticNode } from '../types';
import type { GraphContext } from './context';
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
		insertedAt,
		selectionStore,
		filtersStore,
		addEdge,
		emit,
		focusInternal,
		pruneToIds,
		reset,
		state
	} = ctx;

	return {
		setSelection: (nodeId) => {
			if (nodeId) focusInternal(nodeId);
			else selectionStore.set(null);
		},
		focusNode: (nodeId) => focusInternal(nodeId),

		showRows: (focusId, rows) => {
			if (!nodes.has(focusId)) return;
			for (const row of rows) {
				const id = nodeId(row.ref.collection, row.ref.key);
				if (!nodes.has(id)) {
					const node = syntheticNode(row.ref.collection, row.ref.key, row.title, row.props ?? {});
					insertedAt.set(id, ++state.seq);
					nodes.set(id, node);
				}
				const [source, target] = row.direction === 'inbound' ? [id, focusId] : [focusId, id];
				addEdge(source, target, row.relation, { status: row.proposed ? 'voorgesteld' : null });
			}
			emit();
		},
		hideRows: (ids) => {
			const selectedId = get(selectionStore)?.id;
			const drop = new Set(ids.filter((id) => id !== selectedId && !pinned.has(id)));
			for (const id of drop) {
				nodes.delete(id);
				insertedAt.delete(id);
			}
			for (const [id, e] of [...edges]) {
				if (drop.has(e.source) || drop.has(e.target)) edges.delete(id);
			}
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
			let dropped = false;
			for (const id of [...nodes.keys()]) {
				if (connected.has(id) || pinned.has(id) || id === selectedId || isContainerMember(id))
					continue;
				nodes.delete(id);
				insertedAt.delete(id);
				dropped = true;
			}
			if (dropped) emit();
		}
	};
}
