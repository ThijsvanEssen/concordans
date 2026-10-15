import type { GraphStore } from './store/types';
import { createGraphContext } from './store/context';
import { createCompose } from './store/compose';
import { createExpansion } from './store/expansion';
import { createViewActions } from './store/view-actions';

export function createGraphStore(): GraphStore {
	const ctx = createGraphContext();
	const netwerk = createCompose(ctx);
	const view = createViewActions(ctx);

	return {
		nodes: ctx.nodesStore,
		edges: ctx.edgesStore,
		selection: ctx.selectionStore,
		pinned: ctx.pinnedStore,
		filters: ctx.filtersStore,
		trimmedCount: ctx.trimmedCountStore,
		containers: ctx.containers.groups,
		...createExpansion(ctx),
		...view,
		...netwerk,
		reset: () => {
			view.reset();
			netwerk.releaseNetwerk();
		}
	};
}
