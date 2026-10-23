import type { Schema } from '$lib/api/types';
import { neighborsOf } from '$lib/api/nodes';
import { instrumentContainerId } from '$lib/text/instrument-meta';
import { between, type Between } from '$lib/selection/netwerk';
import { get, writable } from 'svelte/store';
import type { GraphContext } from './context';
import type { GraphStore } from './types';
import { lawIdOf } from '../types';
import { neighbours } from '../adjacency';
import { nodeId } from '$lib/vocabulary';

/**
 * The canvas of a netwerk: the chosen bronnen that are on, what ties them, and
 * whatever context the reader added around them (a group of Verbonden, a depth
 * around the selection). What only a bron switched off or removed brought in goes.
 */
export function createCompose(
	ctx: GraphContext
): Pick<GraphStore, 'compose' | 'clearContext' | 'releaseNetwerk' | 'core'> {
	const {
		nodes,
		edges,
		pinned,
		pinnedStore,
		selectionStore,
		mergeInto,
		anchorContainer,
		trimToCap,
		pruneToIds,
		removeNodes,
		emit
	} = ctx;

	/** The chosen bronnen and what ties them; null while no netwerk is composed. */
	const coreStore = writable<ReadonlySet<string> | null>(null);

	/** Every bron an edge path reaches from `start`. */
	const reachable = (start: Iterable<string>) => {
		const adjacent = neighbours(edges.values());
		const seen = new Set<string>();
		const queue = [...start].filter((id) => nodes.has(id));
		for (const id of queue) seen.add(id);
		while (queue.length) {
			for (const next of adjacent.get(queue.pop()!) ?? []) {
				if (seen.has(next)) continue;
				seen.add(next);
				queue.push(next);
			}
		}
		return seen;
	};

	const compose: GraphStore['compose'] = ({
		participants,
		withJoining,
		fresh,
		onPaths = [],
		tiedByPaths = [],
		surroundings = false
	}) => {
		const selectedId = get(selectionStore)?.id ?? null;
		const on: string[] = participants.map((p) => nodeIdOf(p.response));
		const result: Between = between(
			participants.map((p, i) => ({
				id: on[i],
				lawId:
					p.response.node.collection === 'instruments'
						? instrumentContainerId({ ...p.response.node.props, key: p.response.node.key })
						: null,
				neighbors: neighborsOf(p.response)
			})),
			(n) => (n.collection === 'articles' ? lawIdOf(n.props) : null),
			withJoining,
			surroundings
		);

		const wanted = new Set<string>(on);
		for (const kept of result.keep.values()) for (const id of kept) wanted.add(id);
		// What lies on a path between two chosen bronnen, further than one shared neighbour
		// (member → stuk → wet → artikel, BE-38): joining too, when the joining are drawn.
		const onPath = withJoining ? onPaths.filter((id) => !on.includes(id)) : [];
		for (const id of onPath) {
			wanted.add(id);
			result.joining.add(id);
		}

		// What the last composition drew and this one does not: a bron switched off or
		// removed, and what only tied it.
		const before = get(coreStore) ?? new Set<string>();
		removeNodes([...before].filter((id) => !wanted.has(id) && id !== selectedId));

		participants.forEach((p, i) => {
			const kept = result.keep.get(on[i])!;
			mergeInto(
				p.response,
				Number.POSITIVE_INFINITY,
				(id) => kept.has(id),
				(id) => result.joining.has(id)
			);
			anchorContainer(p.response.node);
		});

		const core = new Set([...wanted].filter((id) => nodes.has(id)));
		const keep = fresh ? new Set(core) : reachable(selectedId ? [...core, selectedId] : core);
		if (selectedId) keep.add(selectedId);
		pruneToIds(keep);

		pinned.clear();
		for (const id of on) pinned.add(id);
		pinnedStore.set(new Set(pinned));
		trimToCap();
		coreStore.set(core);
		emit();
		const alone = new Set([...result.alone].filter((id) => !tiedByPaths.includes(id)));
		return { alone, joining: [...result.joining].filter((id) => nodes.has(id)) };
	};

	return {
		compose,
		core: { subscribe: coreStore.subscribe },
		clearContext: () => {
			const core = get(coreStore);
			if (!core) return;
			const keep = new Set(core);
			const selectedId = get(selectionStore)?.id;
			if (selectedId) keep.add(selectedId);
			pruneToIds(keep);
			emit();
		},
		releaseNetwerk: () => {
			pinned.clear();
			pinnedStore.set(new Set());
			coreStore.set(null);
		}
	};
}

const nodeIdOf = (response: Schema<'NodeGraphResponse'>) =>
	nodeId(response.node.collection, response.node.key);
