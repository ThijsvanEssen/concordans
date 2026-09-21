import type { GraphNode } from '../types';

/** Sets the start position (and size) of a node; Sigma's force layout takes over from there. */
export function place(node: GraphNode, x: number, y: number, size?: number): GraphNode {
	node.x = x;
	node.y = y;
	if (size !== undefined) node.size = size;
	return node;
}

/** Point `i` of `n` on a circle; the first sits at the top and the rest follow clockwise. */
export function onCircle(
	i: number,
	n: number,
	radius: number,
	center = { x: 0, y: 0 }
): { x: number; y: number } {
	const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
	return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Fills a disc evenly: member `i` of a cluster whose outermost member sits at about `radius`. */
export function inDisc(
	i: number,
	count: number,
	radius: number,
	center: { x: number; y: number }
): { x: number; y: number } {
	const r = (radius / Math.max(Math.sqrt(count), 1)) * Math.sqrt(i);
	const angle = i * GOLDEN_ANGLE;
	return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
}
