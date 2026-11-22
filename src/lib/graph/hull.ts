// The disc around a group of points, for the hull the Netwerkschets draws behind a wet's
// artikelen or a fractie's, commissie's or dossier's leden.

export type Point = { x: number; y: number };

type HullShape = {
	/** The points the path passes through, and each point's top: where a label anchors. */
	outline: Point[];
	/** The outline as a closed polygon, in order: what a line between hulls is cut at. */
	polygon: Point[];
	path: string;
};

/** The corners of the polygon that stands for the circle around one point. */
const CIRCLE_CORNERS = 24;

/**
 * The disc around `points` plus `margin` (Netwerkcanvas: "een schijf om de leden plus 16 px"):
 * centred on the middle of their box, as wide as the farthest point. `outline` holds its top,
 * where the label anchors; `polygon` the circle as corners, where a line is cut.
 */
export function hullOutline(points: Point[], margin: number): HullShape {
	if (points.length === 0) return { outline: [], polygon: [], path: '' };
	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);
	const x = (Math.min(...xs) + Math.max(...xs)) / 2;
	const y = (Math.min(...ys) + Math.max(...ys)) / 2;
	const r = Math.max(...points.map((p) => Math.hypot(p.x - x, p.y - y))) + margin;
	const path = `M ${x - r} ${y} A ${r} ${r} 0 1 0 ${x + r} ${y} A ${r} ${r} 0 1 0 ${x - r} ${y} Z`;
	const polygon = Array.from({ length: CIRCLE_CORNERS }, (_, i) => ({
		x: x + Math.cos((i / CIRCLE_CORNERS) * Math.PI * 2) * r,
		y: y + Math.sin((i / CIRCLE_CORNERS) * Math.PI * 2) * r
	}));
	return { outline: [{ x, y: y - r }], polygon, path };
}
