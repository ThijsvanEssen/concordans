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
 * A padded, rounded outline `margin` px outside the hull of `points`, and the
 * closed SVG path that draws it. Kept apart from the path string because the
 * label anchors to this outline's own top, not to a raw point two hulls with
 * an overlapping member could otherwise share.
 */
export function hullOutline(points: Point[], margin: number): { outline: Point[]; path: string } {
	if (points.length === 0) return { outline: [], path: '' };
	if (points.length === 1) {
		const { x, y } = points[0];
		const path = `M ${x - margin} ${y} A ${margin} ${margin} 0 1 0 ${x + margin} ${y} A ${margin} ${margin} 0 1 0 ${x - margin} ${y} Z`;
		return { outline: [{ x, y: y - margin }], path };
	}

	let outline = convexHull(points);
	if (outline.length === 2) {
		// Two points have no area: a stadium around the segment instead.
		const [a, b] = outline;
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		const nx = (-dy / len) * margin;
		const ny = (dx / len) * margin;
		outline = [
			{ x: a.x + nx, y: a.y + ny },
			{ x: b.x + nx, y: b.y + ny },
			{ x: b.x - nx, y: b.y - ny },
			{ x: a.x - nx, y: a.y - ny }
		];
	}

	const cx = outline.reduce((s, p) => s + p.x, 0) / outline.length;
	const cy = outline.reduce((s, p) => s + p.y, 0) / outline.length;
	const padded = outline.map((p) => {
		const dx = p.x - cx;
		const dy = p.y - cy;
		const len = Math.hypot(dx, dy) || 1;
		return { x: p.x + (dx / len) * margin, y: p.y + (dy / len) * margin };
	});

	// A smooth closed path through the padded points: quadratic curves through
	// the midpoint of each pair, so the hull reads as a soft blob, not a polygon.
	const mid = (p: Point, q: Point) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
	const n = padded.length;
	const start = mid(padded[n - 1], padded[0]);
	let d = `M ${start.x} ${start.y}`;
	for (let i = 0; i < n; i++) {
		const p = padded[i];
		const next = padded[(i + 1) % n];
		const m = mid(p, next);
		d += ` Q ${p.x} ${p.y} ${m.x} ${m.y}`;
	}
	return { outline: padded, path: d + ' Z' };
}
