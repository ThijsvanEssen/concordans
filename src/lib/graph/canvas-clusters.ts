// Which bronnen of the canvas stand folded into a cluster bron. One rule for two readers:
// the canvas draws by it (GraphView), and the budget counts by it (`store/budget.ts`), so a
// group that is drawn as one costs one place.
import { clustersOf, tussenClustersOf, type Cluster } from '$lib/selection/cluster';
import { containerIdFor, isContainerKind, type ContainerGroup } from './container-membership';
import { isVersionCollection, type GraphEdge, type GraphNode } from './types';

/**
 * A container (a wet, fractie, commissie or dossier) is never a canvas node: its children
 * carry it as a hull instead. Nor is a version: the network is about the current text.
 */
export const isCanvasNode = (n: GraphNode) =>
	(n.anchor || !isContainerKind(n.drawClass)) && !isVersionCollection(n.collection);

/** The bronnen in the hull of a chosen law (its articles); undefined for any other bron. */
export function hullOfLaw(
	node: Pick<GraphNode, 'collection' | 'key' | 'raw'> | undefined,
	groups: ReadonlyMap<string, ContainerGroup>
): ReadonlySet<string> | undefined {
	if (!node || node.collection !== 'instruments') return undefined;
	const cid = containerIdFor(node.raw ?? node);
	return cid ? groups.get(cid)?.members : undefined;
}

export type ClusterInput = {
	/** The nodes the canvas draws (`isCanvasNode`). */
	nodes: readonly GraphNode[];
	/** The lines the canvas draws (`isDrawn`). */
	edges: readonly Pick<GraphEdge, 'source' | 'target' | 'relation'>[];
	focus: string | null;
	/** The chosen bronnen of a netwerk. */
	pinned: ReadonlySet<string>;
	/** What ties the chosen bronnen; null outside a netwerk. */
	core: ReadonlySet<string> | null;
	/** The weergave Omgeving. */
	surroundings: boolean;
	/** Every hull's members: never folded in. */
	groups: ReadonlyMap<string, ContainerGroup>;
	/** More loose bronnen of one kind than this fold (`looseMaxFor`). */
	looseMax: number;
	/** A chosen bron by its id, for its hull. */
	nodeOf: (id: string) => GraphNode | undefined;
};

/**
 * The clusters of a canvas, `expanded` ones left open. In Omgeving every chosen bron folds its
 * own loose neighbours past forty a kind and its own articles past forty as "203 artikelen";
 * else what ties the chosen bronnen stays drawn bron by bron.
 */
export function canvasClusters(input: ClusterInput, expanded: ReadonlySet<string>): Cluster[] {
	const { nodes, edges, focus, pinned, core, surroundings, groups, nodeOf, looseMax } = input;
	const inHull = new Set<string>();
	for (const group of groups.values()) for (const id of group.members) inHull.add(id);
	const keep = new Set<string>([...pinned, ...(surroundings ? [] : (core ?? [])), ...inHull]);
	const chosen = new Set<string>(pinned);
	if (focus) chosen.add(focus);
	const centres = surroundings && pinned.size > 0 ? [...pinned] : focus ? [focus] : [];

	const ownArticles: Cluster[] = !surroundings
		? []
		: [...pinned].flatMap((id) => {
				const hull = hullOfLaw(nodeOf(id), groups);
				const members = [...(hull ?? [])].filter((m) => !pinned.has(m));
				const cl: Cluster = {
					id: `cluster:articles@${id}`,
					collection: 'articles',
					members,
					relation: 'PART_OF',
					toFocus: true,
					neighbours: members.length,
					ends: [{ id, relation: 'PART_OF', toEnd: true }]
				};
				return members.length > looseMax && !expanded.has(cl.id) ? [cl] : [];
			});
	return [
		...ownArticles,
		...centres.flatMap((c) =>
			clustersOf(nodes, edges, c, keep, expanded, c === focus ? '' : `@${c}`, looseMax).map((cl) =>
				c === focus ? cl : { ...cl, ends: [{ id: c, relation: cl.relation, toEnd: cl.toFocus }] }
			)
		),
		...(pinned.size > 0 ? tussenClustersOf(nodes, edges, chosen, inHull, expanded) : [])
	];
}
