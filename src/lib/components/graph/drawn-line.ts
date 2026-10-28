// A line of Verband as the Design System draws it (Netwerkcanvas, Lijnen): the colour, stroke and
// arrow of its kind, mixed toward the paper, bent and ending at the edge of its bron
// (graph/line-shape). The shared bronnen and the ketens draw their lines with this one.
import { curvedLine } from '$lib/graph/line-shape';
import { hasArrow } from '$lib/graph/line-kind';
import { EDGE_WEIGHT, drawClassOf } from '$lib/graph/types';
import {
	arrowLength,
	edgeCapFor,
	edgeColorFor,
	edgeDashFor,
	edgeStyleFor,
	edgeToneFor,
	toneColour,
	lineThickness
} from '$lib/components/graph/nodeSprites';
import type { Collection, Relation } from '$lib/vocabulary';

type Point = { x: number; y: number };

type DrawnLine = {
	d: string;
	head: string | null;
	dot: Point | null;
	middle: Point;
	colour: string;
	dash: string | undefined;
	cap: 'round' | 'butt';
	width: number;
};

/**
 * The line of `relation` (null: a plain rule) from `a` to `b`, `from` the collection it starts
 * at; `arrow` says at which end the arrow stands (`a` or `b`, the end that is named). `ra` and
 * `rb` are the radii of what it ends at; `width` overrides the thickness of its kind.
 */
export function drawnLine(
	a: Point,
	b: Point,
	o: {
		relation: Relation | null;
		from: Collection | null;
		arrow: 'a' | 'b' | null;
		ra: number;
		rb: number;
		width?: number;
	}
): DrawnLine {
	const rel = o.relation;
	const from = drawClassOf(o.from ?? 'instruments');
	const style = rel ? edgeStyleFor(rel, null, from) : 'punten';
	const width = o.width ?? (rel ? Math.max(lineThickness(EDGE_WEIGHT[rel]), 1.4) : 1.4);
	const shape = curvedLine(a, b, {
		ra: o.ra,
		rb: o.rb,
		width,
		arrow: arrowLength(),
		head: hasArrow(style) ? o.arrow : null,
		end: o.arrow ?? 'b',
		dot: style === 'puntenIndiener' ? 'a' : null
	});
	return {
		...shape,
		colour: rel
			? toneColour(edgeColorFor(rel, from), edgeToneFor(rel, null, from))
			: 'var(--rule-strong)',
		dash: edgeDashFor(style),
		cap: edgeCapFor(style),
		width
	};
}
