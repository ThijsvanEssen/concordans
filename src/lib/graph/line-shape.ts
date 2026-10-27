// The shape of a line as the Design System draws it (Netwerkcanvas, Lijnen): slightly curved,
// ending at the edge of its bron, an arrowhead of --netwerk-pijl thicknesses long and 0,8 of that
// wide, at least 5,5 px, and for Ingediend door a dot at the one who submits. Pure: the sketch and
// the keten draw it as SVG, the canvas (DashedEdgeProgram) as the same curve in a shader.

/** How far a line bends: its control point stands this part of its length beside its middle. */
export const BEND = 0.12;
/** The radius of the dot at the one who submits. */
export const DOT_RADIUS = 2.6;
/** The air between a line and the edge of its bron. */
export const AIR = 3;
/** An arrowhead's width to its length. */
export const ARROW_WIDTH = 0.8;
/** An arrowhead is at least this long, in px (Netwerkcanvas, Maten). */
export const MIN_ARROW_PX = 5.5;

type Point = { x: number; y: number };

type CurvedLine = {
	/** The body, a quadratic bezier from the edge of the one bron to the edge of the other. */
	d: string;
	/** The points of the arrowhead, or null. */
	head: string | null;
	/** The dot at the submitter, or null. */
	dot: Point | null;
	/** The middle of the curve, where its label stands. */
	middle: Point;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const unit = (dx: number, dy: number): [number, number] => {
	const d = Math.hypot(dx, dy) || 1;
	return [dx / d, dy / d];
};

/** The length of an arrowhead on a line `width` thick, `arrow` thicknesses long (--netwerk-pijl). */
export const headLength = (width: number, arrow: number) => Math.max(width * arrow, MIN_ARROW_PX);

/**
 * A line from `a` to `b`: it stops `ra` and `rb` (plus AIR) from their centres, along the
 * tangent of its bend; `bend` 1 or -1 picks the side. The arrowhead stands at `head` ('a' or
 * 'b'), the body ending where it begins; `dot` puts a dot at that end of the line.
 */
export function curvedLine(
	a: Point,
	b: Point,
	o: {
		ra: number;
		rb: number;
		width: number;
		/** The arrowhead's length in thicknesses (--netwerk-pijl). */
		arrow: number;
		head?: 'a' | 'b' | null;
		dot?: 'a' | 'b' | null;
		bend?: number;
	}
): CurvedLine {
	const length = Math.hypot(b.x - a.x, b.y - a.y);
	const [nx, ny] = unit(-(b.y - a.y), b.x - a.x);
	const bend = (o.bend ?? 1) * BEND * length;
	const c = { x: (a.x + b.x) / 2 + nx * bend, y: (a.y + b.y) / 2 + ny * bend };
	const [ua, va] = unit(c.x - a.x, c.y - a.y);
	const [ub, vb] = unit(b.x - c.x, b.y - c.y);
	let p = { x: a.x + ua * (o.ra + AIR), y: a.y + va * (o.ra + AIR) };
	let q = { x: b.x - ub * (o.rb + AIR), y: b.y - vb * (o.rb + AIR) };
	const len = headLength(o.width, o.arrow);
	const tipAt = (tip: Point, [dx, dy]: [number, number]) => {
		const bx = tip.x - dx * len;
		const by = tip.y - dy * len;
		const ox = (-dy * len * ARROW_WIDTH) / 2;
		const oy = (dx * len * ARROW_WIDTH) / 2;
		return `${r1(tip.x)},${r1(tip.y)} ${r1(bx + ox)},${r1(by + oy)} ${r1(bx - ox)},${r1(by - oy)}`;
	};
	let head: string | null = null;
	if (o.head === 'b') {
		head = tipAt(q, [ub, vb]);
		q = { x: q.x - ub * len, y: q.y - vb * len };
	} else if (o.head === 'a') {
		head = tipAt(p, [-ua, -va]);
		p = { x: p.x + ua * len, y: p.y + va * len };
	}
	const dot = o.dot === 'a' ? p : o.dot === 'b' ? q : null;
	return {
		d: `M${r1(p.x)} ${r1(p.y)}Q${r1(c.x)} ${r1(c.y)} ${r1(q.x)} ${r1(q.y)}`,
		head,
		dot: dot && { x: r1(dot.x), y: r1(dot.y) },
		middle: { x: r1((p.x + 2 * c.x + q.x) / 4), y: r1((p.y + 2 * c.y + q.y) / 4) }
	};
}
