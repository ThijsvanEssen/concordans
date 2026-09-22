import type { GraphStore } from './store/types';
import { createGraphContext } from './store/context';
import { createExpansion } from './store/expansion';
import { createWetLoaders } from './store/wet-loaders';
import { createWetCitations } from './store/wet-citations';
import { createGlobalLoaders } from './store/global-loaders';
import { createParliamentaryLoaders } from './store/parliamentary-loaders';
import { createViewActions } from './store/view-actions';

export type {
	GraphExpansionOptions,
	GraphFilters,
	GraphMode,
	GraphStore,
	LoadingState
} from './store/types';

export function createGraphStore(): GraphStore {
	const ctx = createGraphContext();

	return {
		nodes: ctx.nodesStore,
		edges: ctx.edgesStore,
		selection: ctx.selectionStore,
		pinned: ctx.pinnedStore,
		filters: ctx.filtersStore,
		loading: ctx.loadingStore,
		graphMode: ctx.graphModeStore,
		potentialCounts: ctx.potentialCountsStore,
		trimmedCount: ctx.trimmedCountStore,
		currentInstrumentBwb: ctx.currentInstrumentBwbStore,
		...createExpansion(ctx),
		...createWetLoaders(ctx),
		...createWetCitations(ctx),
		...createGlobalLoaders(ctx),
		...createParliamentaryLoaders(ctx),
		...createViewActions(ctx)
	};
}
