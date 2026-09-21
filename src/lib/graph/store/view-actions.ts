import { get } from 'svelte/store';
import type { GraphContext } from './context';
import type { GraphStore } from './types';

export function createViewActions(
	ctx: GraphContext
): Pick<
	GraphStore,
	| 'setGraphMode'
	| 'setSelection'
	| 'togglePin'
	| 'unpinNode'
	| 'focusNode'
	| 'goBack'
	| 'goForward'
	| 'reset'
	| 'setFilters'
	| 'getNodeById'
	| 'pruneNodes'
	| 'setCollapseToLaws'
	| 'sweepOrphans'
> {
	const {
		nodes,
		edges,
		history,
		pinned,
		insertedAt,
		selectionStore,
		pinnedStore,
		filtersStore,
		graphModeStore,
		emit,
		updateHistoryFlags,
		focusInternal,
		reset,
		state
	} = ctx;

	// Moves along the history without adding to it.
	const step = (delta: number) => {
		const index = state.historyIndex + delta;
		if (index < 0 || index >= history.length) return null;
		state.historyIndex = index;
		focusInternal(history[index], { recordHistory: false });
		updateHistoryFlags();
		return history[index];
	};

	const publishPinned = () => pinnedStore.set(new Set(pinned));

	return {
		setGraphMode: (mode) => graphModeStore.set(mode),

		setSelection: (nodeId, opts) => {
			if (nodeId) focusInternal(nodeId, opts);
			else selectionStore.set(null);
		},
		focusNode: (nodeId, opts) => focusInternal(nodeId, opts),
		goBack: () => step(-1),
		goForward: () => step(1),

		togglePin: (nodeId) => {
			if (!pinned.delete(nodeId)) pinned.add(nodeId);
			publishPinned();
		},
		unpinNode: (nodeId) => {
			pinned.delete(nodeId);
			publishPinned();
		},

		reset,

		setFilters: (updater) => {
			const current = get(filtersStore);
			filtersStore.set({
				...current,
				...updater,
				nodeTypeToggles: { ...current.nodeTypeToggles, ...updater.nodeTypeToggles }
			});
		},

		getNodeById: (nodeId) => nodes.get(nodeId),

		pruneNodes: (keepIds) => {
			for (const id of [...nodes.keys()]) if (!keepIds.has(id)) nodes.delete(id);
			for (const [id, e] of [...edges]) {
				if (!keepIds.has(e.source) || !keepIds.has(e.target)) edges.delete(id);
			}
			emit();
		},

		setCollapseToLaws: (collapse) => {
			if (state.proxiesEnabled === collapse) return;
			state.proxiesEnabled = collapse;
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
				if (connected.has(id) || pinned.has(id) || id === selectedId) continue;
				nodes.delete(id);
				insertedAt.delete(id);
				dropped = true;
			}
			if (dropped) emit();
		}
	};
}
