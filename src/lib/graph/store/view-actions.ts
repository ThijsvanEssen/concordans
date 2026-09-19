import { graphNodeId } from '../types';
import { get } from 'svelte/store';
import type { GraphContext } from './context';
import type { GraphStore } from './types';

export function createViewActions(ctx: GraphContext): Pick<GraphStore, 'setGraphMode' | 'seedGraph' | 'setSelection' | 'togglePin' | 'pinNode' | 'unpinNode' | 'focusNode' | 'goBack' | 'goForward' | 'reset' | 'setFilters' | 'getNodeById' | 'getNeighborsOf' | 'pruneNodes' | 'setCollapseToLaws' | 'sweepOrphans'> {
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
    updateNodes,
    updateEdges,
    updateBreadcrumbs,
    clearGraph,
    focusInternal,
    state
  } = ctx;

  return {
    setGraphMode: (mode) => { graphModeStore.set(mode); },

    seedGraph: (seed) => {
      clearGraph();
      for (const node of seed.nodes) {
        nodes.set(node.id, node);
      }
      for (const edge of seed.edges ?? []) {
        edges.set(edge.id, edge);
      }
      updateNodes();
      updateEdges();
      if (seed.focus) {
        focusInternal(graphNodeId(seed.focus.collection, seed.focus.key));
      }
    },
    setSelection: (nodeId, opts) => {
      if (!nodeId) {
        selectionStore.set(null);
        return;
      }
      focusInternal(nodeId, opts);
    },
    togglePin: (nodeId) => {
      if (pinned.has(nodeId)) {
        pinned.delete(nodeId);
      } else {
        pinned.add(nodeId);
      }
      pinnedStore.set(new Set(pinned));
    },
    pinNode: (nodeId) => {
      pinned.add(nodeId);
      pinnedStore.set(new Set(pinned));
    },
    unpinNode: (nodeId) => {
      pinned.delete(nodeId);
      pinnedStore.set(new Set(pinned));
    },
    focusNode: (nodeId, opts) => focusInternal(nodeId, opts),
    goBack: () => {
      if (state.historyIndex <= 0) return null;
      state.historyIndex -= 1;
      const nodeId = history[state.historyIndex];
      if (nodeId) {
        focusInternal(nodeId, { recordHistory: false });
        updateBreadcrumbs();
      }
      return nodeId ?? null;
    },
    goForward: () => {
      if (state.historyIndex >= history.length - 1) return null;
      state.historyIndex += 1;
      const nodeId = history[state.historyIndex];
      if (nodeId) {
        focusInternal(nodeId, { recordHistory: false });
        updateBreadcrumbs();
      }
      return nodeId ?? null;
    },
    reset: () => {
      clearGraph();
      pinned.clear();
      pinnedStore.set(new Set());
    },
    setFilters: (updater) => {
      const current = get(filtersStore);
      filtersStore.set({
        ...current,
        ...updater,
        nodeTypeToggles: {
          ...current.nodeTypeToggles,
          ...(updater.nodeTypeToggles ?? {})
        },
        activeInstruments: updater.activeInstruments ?? current.activeInstruments
      });
    },
    getNodeById: (nodeId) => nodes.get(nodeId),
    getNeighborsOf: (nodeId) => {
      const neighbors = new Set<string>();
      edges.forEach((edge) => {
        if (edge.source === nodeId) {
          neighbors.add(edge.target);
        }
        if (edge.target === nodeId) {
          neighbors.add(edge.source);
        }
      });
      return [...neighbors];
    },
    pruneNodes: (keepIds) => {
      for (const id of [...nodes.keys()]) {
        if (!keepIds.has(id)) nodes.delete(id);
      }
      for (const [id, edge] of [...edges.entries()]) {
        if (!keepIds.has(edge.source) || !keepIds.has(edge.target)) {
          edges.delete(id);
        }
      }
      updateNodes();
      updateEdges();
    },
    setCollapseToLaws: (collapse) => {
      if (state.proxiesEnabled === collapse) return;
      state.proxiesEnabled = collapse;
      // Re-fire emits so synthesizeDerivedNodes runs with the new flag —
      // adds proxies when collapsing, drops them when expanding back to
      // Artikelen view.
      updateNodes();
      updateEdges();
    },
    sweepOrphans: () => {
      // Build a set of node ids that still have at least one incident edge.
      const connected = new Set<string>();
      for (const e of edges.values()) {
        connected.add(e.source);
        connected.add(e.target);
      }
      const sel = get(selectionStore);
      let dropped = 0;
      for (const id of [...nodes.keys()]) {
        if (connected.has(id)) continue;
        if (pinned.has(id)) continue;
        if (sel && sel.id === id) continue; // focal stays even if alone
        nodes.delete(id);
        insertedAt.delete(id);
        dropped += 1;
      }
      if (dropped > 0) {
        updateNodes();
        updateEdges();
      }
    }
  };
}
