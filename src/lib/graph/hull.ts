// A soft outline around a group of viewport points, for the containment hulls
// GraphCanvas draws behind a wet's artikelen or a fractie's/commissie's leden.
//
// Drawn as the padded convex hull of the group, one smooth shape rather than a
// circle per member. A bron that is not a member but happens to sit inside that
// hull is a layout problem, not a drawing one: GraphView pulls a group's members
// into a tight ring with invisible `layoutOnly` edges precisely so the hull they
// span stays small and does not reach out to whatever else is on canvas.

export type Point = { x: number; y: number };

function cross(o: Point, a: Point, b: Point): number {
	return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** The convex hull of two or more points, by Andrew's monotone chain. */
export function convexHull(points: Point[]): Point[] {
	const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
	if (pts.length <= 2) return pts;
	const lower: Point[] = [];
	for (const p of pts) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
			lower.pop();
		lower.push(p);
	}
	const upper: Point[] = [];
	for (let i = pts.length - 1; i >= 0; i--) {
		const p = pts[i];
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
			upper.pop();
		upper.push(p);
	}
	lower.pop();
	upper.pop();
	return [...lower, ...upper];
}

/**
 * The outline `margin` px outside the hull of `points`, and the closed SVG path that
 * draws it: every side of the hull moved out by `margin`, every corner an arc of
 * radius `margin` around its point (the hull grown by a disk). Every point lies at
 * least `margin` inside it, however few points there are; a curve through the
 * midpoints of the padded corners would cut those corners and leave a point on the
 * edge. `outline` holds the points the path passes through, so the label can anchor
 * to this hull's own top.
 */
export type HullShape = {
	/** The points the path passes through, and each point's top: where a label anchors. */
	outline: Point[];
	/** The outline as a closed polygon, in order: what a line between hulls is cut at. */
	polygon: Point[];
	path: string;
};

/** The corners of the polygon that stands for the circle around one point. */
const CIRCLE_CORNERS = 24;

export function hullOutline(points: Point[], margin: number): HullShape {
	if (points.length === 0) return { outline: [], polygon: [], path: '' };
	if (points.length === 1) {
		const { x, y } = points[0];
		const path = `M ${x - margin} ${y} A ${margin} ${margin} 0 1 0 ${x + margin} ${y} A ${margin} ${margin} 0 1 0 ${x - margin} ${y} Z`;
		const polygon = Array.from({ length: CIRCLE_CORNERS }, (_, i) => ({
			x: x + Math.cos((i / CIRCLE_CORNERS) * Math.PI * 2) * margin,
			y: y + Math.sin((i / CIRCLE_CORNERS) * Math.PI * 2) * margin
		}));
		return { outline: [{ x, y: y - margin }], polygon, path };
	}

	const hull = convexHull(points);
	const n = hull.length;
	// The monotone chain winds counter-clockwise in its own coordinates, so (dy, -dx)
	// points out of every side; for two points the two sides face opposite ways.
	const outward = (a: Point, b: Point): Point => {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		return { x: (dy / len) * margin, y: (-dx / len) * margin };
	};
	const outline: Point[] = [];
	const polygon: Point[] = [];
	let path = '';
	for (let i = 0; i < n; i++) {
		const p = hull[i];
		const before = outward(hull[(i - 1 + n) % n], p);
		const after = outward(p, hull[(i + 1) % n]);
		const from = { x: p.x + before.x, y: p.y + before.y };
		const to = { x: p.x + after.x, y: p.y + after.y };
		outline.push(from, to, { x: p.x, y: p.y - margin });
		polygon.push(from, to);
		path += `${i === 0 ? 'M' : 'L'} ${from.x} ${from.y} A ${margin} ${margin} 0 0 1 ${to.x} ${to.y} `;
	}
	return { outline, polygon, path: path + 'Z' };
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
