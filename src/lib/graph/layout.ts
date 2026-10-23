// Where the bronnen stand on the canvas of the werkplek (besluit 39, mockup A197): no force
// layout, an order one can read. The chosen bronnen in the middle (one alone at the centre,
// more side by side), every other bron in the sector of its kind around them, ring after ring,
// in the order given (by date, then by name). Moves the `x` and `y` of the graphology graph
// GraphView draws.
import type Graph from 'graphology';

function moveTo(g: Graph, id: string, x: number, y: number) {
	g.setNodeAttribute(id, 'x', x);
	g.setNodeAttribute(id, 'y', y);
}

/** Between two chosen bronnen side by side, and from the middle to the first ring. */
const CENTRE_GAP = 160;
const RING = 220;
const RING_STEP = 90;
/** The room of one bron along a ring, so names have space. */
const ARC = 70;

/**
 * The radial order of the canvas. `centre`: the chosen bronnen, or the one bron the canvas is
 * drawn around. `groupOf` names a bron's sector (its kind), `groups` their order around the
 * circle, `compare` the order inside a sector. A sector takes a share of the circle as large as
 * its bronnen; a full ring sends the rest to the next one out.
 */
export function radialLayout(
	g: Graph,
	centre: readonly string[],
	groupOf: (id: string) => string,
	groups: readonly string[],
	compare: (a: string, b: string) => number
): void {
	const mids = centre.filter((id) => g.hasNode(id));
	mids.forEach((id, i) => moveTo(g, id, (i - (mids.length - 1) / 2) * CENTRE_GAP, 0));
	const inner = RING + ((mids.length - 1) * CENTRE_GAP) / 2;
	const per = new Map<string, string[]>();
	g.forEachNode((id) => {
		if (mids.includes(id)) return;
		const k = groupOf(id);
		per.set(k, [...(per.get(k) ?? []), id]);
	});
	const order = [
		...groups.filter((k) => per.has(k)),
		...[...per.keys()].filter((k) => !groups.includes(k))
	];
	const total = [...per.values()].reduce((n, ids) => n + ids.length, 0);
	if (!total) return;
	let start = -Math.PI / 2;
	for (const k of order) {
		const ids = per.get(k)!.sort(compare);
		const span = (ids.length / total) * Math.PI * 2;
		let placed = 0;
		let ring = 0;
		while (placed < ids.length) {
			const r = inner + ring * RING_STEP;
			const room = Math.max(1, Math.floor((span * r) / ARC));
			const these = ids.slice(placed, placed + room);
			these.forEach((id, i) => {
				const angle = start + ((i + 0.5) / these.length) * span;
				moveTo(g, id, Math.cos(angle) * r, Math.sin(angle) * r);
			});
			placed += these.length;
			ring++;
		}
		start += span;
	}
}

/** Each bron tied to `id` by a drawn line, passing over a link that is no line (`layoutOnly`). */
export function forEachRealNeighbor(g: Graph, id: string, fn: (neighbor: string) => void) {
	const seen = new Set<string>();
	g.forEachEdge(id, (_e, a, src, tgt) => {
		const other = src === id ? tgt : src;
		if (a.layoutOnly || seen.has(other)) return;
		seen.add(other);
		fn(other);
	});
}

/** The number of drawn lines at `id`, without the links of a hull. */
export function realDegree(g: Graph, id: string): number {
	let n = 0;
	g.forEachEdge(id, (_e, a) => {
		if (!a.layoutOnly) n++;
	});
	return n;
}
