// Which bronnen are nodes of the canvas, and which hull a chosen law has.
import { containerIdFor, isContainerKind, type ContainerGroup } from './container-membership';
import { isVersionCollection, type GraphNode } from './types';

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
