// Which bronnen of the canvas stand folded into a cluster bron. One rule for two readers:
// the canvas draws by it (GraphView), and the budget counts by it (`store/budget.ts`), so a
// group that is drawn as one costs one place.
import { clustersOf, isClusterId, tussenClustersOf, type Cluster } from '$lib/selection/cluster';
import { containerIdFor, isContainerKind, type ContainerGroup } from './container-membership';
import { isVersionCollection, type GraphEdge, type GraphNode } from './types';

/**
 * A container (a wet, fractie, commissie or dossier) is never a canvas node: its children
 * carry it as a hull instead. Nor is a version: the network is about the current text.
 */
export const isCanvasNode = (n: GraphNode) =>
	(n.anchor || isClusterId(n.id) || !isContainerKind(n.drawClass)) &&
	!isVersionCollection(n.collection);

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
	edges: readonly (Pick<GraphEdge, 'source' | 'target' | 'relation'> &
		Pick<Partial<GraphEdge>, 'meta'>)[];
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
	/** The dossiers a commissie in focus leads, all of them (Tonen's count): the cluster's whole. */
	ledTotal?: number | null;
};

/**
 * The clusters of a canvas, `expanded` ones left open. In Omgeving every chosen bron folds its
 * own loose neighbours past forty a kind and its own articles past forty as "203 artikelen";
 * else what ties the chosen bronnen stays drawn bron by bron.
 */
export function canvasClusters(input: ClusterInput, expanded: ReadonlySet<string>): Cluster[] {
	const { nodes, edges, focus, pinned, core, surroundings, groups, nodeOf, looseMax } = input;
	const inHull = new Set<string>();
	// A dossier with no stuk on the canvas is its anchor alone, a bron like any (B41).
	const alone = (g: ContainerGroup) => g.kind === 'dossier' && g.parts.size === 0 && g.id !== focus;
	for (const group of groups.values())
		if (!alone(group)) for (const id of group.members) inHull.add(id);
	const keep = new Set<string>([...pinned, ...(surroundings ? [] : (core ?? [])), ...inHull]);
	const chosen = new Set<string>(pinned);
	if (focus) chosen.add(focus);
	const centres = surroundings && pinned.size > 0 ? [...pinned] : focus ? [focus] : [];
	const led = centres.length === 1 ? ledFolded(edges, centres[0], expanded, input.ledTotal) : null;

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
		...(led ? [led] : []),
		...ownArticles,
		...centres.flatMap((c) =>
			clustersOf(
				nodes,
				edges,
				c,
				led ? new Set([...keep, ...led.members]) : keep,
				expanded,
				c === focus ? '' : `@${c}`,
				looseMax
			).map((cl) =>
				c === focus ? cl : { ...cl, ends: [{ id: c, relation: cl.relation, toEnd: cl.toFocus }] }
			)
		),
		...(pinned.size > 0 ? tussenClustersOf(nodes, edges, chosen, inHull, expanded) : [])
	];
}

/** The dossiers a commissie leads that stand as a bron: the latest first (B41). */
const LED_SHOWN = 12;

type LedEdge = ClusterInput['edges'][number];

/**
 * The order of a commissie's dossiers: the latest activity about it she leads first
 * (`meta.latest`, undated last), then the most activities, then the id. As the API sorts
 * them (`sort=importance`); an API without `latest` sorts by the activities alone.
 */
function byLatest(a: LedEdge, b: LedEdge): number {
	const latest = (e: LedEdge) => String(e.meta?.latest ?? '');
	const activities = (e: LedEdge) => Number(e.meta?.activities ?? 0);
	return (
		latest(b).localeCompare(latest(a)) ||
		activities(b) - activities(a) ||
		a.source.localeCompare(b.source)
	);
}

/**
 * Around a commissie, the dossiers it leads past the LED_SHOWN latest (`byLatest`), as one
 * cluster "overige" with one line "Onder leiding van" (B41).
 */
function ledFolded(
	edges: ClusterInput['edges'],
	focus: string | null,
	expanded: ReadonlySet<string>,
	total?: number | null
): Cluster | null {
	const id = 'cluster:dossiers';
	if (!focus?.startsWith('committees/') || expanded.has(id)) return null;
	const led = edges
		.filter(
			(e) => e.relation === 'LED_BY' && e.target === focus && e.source.startsWith('dossiers/')
		)
		.sort(byLatest);
	const members = led.slice(LED_SHOWN).map((e) => e.source);
	if (!members.length) return null;
	return {
		id,
		collection: 'dossiers',
		members,
		relation: 'LED_BY',
		toFocus: true,
		neighbours: led.length,
		ends: [{ id: focus, relation: 'LED_BY', toEnd: true }],
		...(total && total > led.length ? { total: total - LED_SHOWN } : {})
	};
}
