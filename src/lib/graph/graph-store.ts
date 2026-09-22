import type { GraphStore } from './store/types';
import { createGraphContext } from './store/context';
import { createExpansion } from './store/expansion';
import { createViewActions } from './store/view-actions';

export type { GraphExpansionOptions, GraphFilters, GraphStore } from './store/types';

export function createGraphStore(): GraphStore {
	const ctx = createGraphContext();

	return {
		nodes: ctx.nodesStore,
		edges: ctx.edgesStore,
		selection: ctx.selectionStore,
		pinned: ctx.pinnedStore,
		filters: ctx.filtersStore,
		trimmedCount: ctx.trimmedCountStore,
		...createExpansion(ctx),
		...createViewActions(ctx)
	};
}
