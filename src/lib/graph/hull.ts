// The disc around a group of viewport points, for the hulls GraphCanvas draws behind a
// wet's artikelen or a fractie's, commissie's or dossier's leden. That the members stand
// together is the layout's (layout.ts places a hull's members as one).

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

/** The mean of some points: where a line between two hulls starts from. */
export const centroid = (points: Point[]): Point => ({
	x: points.reduce((sum, p) => sum + p.x, 0) / (points.length || 1),
	y: points.reduce((sum, p) => sum + p.y, 0) / (points.length || 1)
});

/**
 * Where the segment from `inside` toward `outside` leaves the convex `polygon`
 * that holds `inside`; `inside` itself when it does not leave it.
 */
export function exitPoint(inside: Point, outside: Point, polygon: Point[]): Point {
	const dx = outside.x - inside.x;
	const dy = outside.y - inside.y;
	let best = Infinity;
	for (let i = 0; i < polygon.length; i++) {
		const a = polygon[i];
		const b = polygon[(i + 1) % polygon.length];
		const ex = b.x - a.x;
		const ey = b.y - a.y;
		const denominator = dx * ey - dy * ex;
		if (Math.abs(denominator) < 1e-9) continue;
		// Solve inside + t * (dx, dy) = a + u * (ex, ey).
		const t = ((a.x - inside.x) * ey - (a.y - inside.y) * ex) / denominator;
		const u = ((a.x - inside.x) * dy - (a.y - inside.y) * dx) / denominator;
		if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
	}
	return best === Infinity ? inside : { x: inside.x + dx * best, y: inside.y + dy * best };
}

/** Whether `p` lies inside `polygon` (even-odd): the pointer over a hull. */
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
	let hit = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const a = polygon[i];
		const b = polygon[j];
		if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
			hit = !hit;
	}
	return hit;
}
