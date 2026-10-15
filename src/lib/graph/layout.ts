// Where the bronnen stand on the canvas, beside ForceAtlas2: a new focus in rings around it,
// the members of a hull pulled together and packed into a disk, and a cluster bron where it
// has room. Each step moves the `x` and `y` of the graphology graph GraphView draws.
import type Graph from 'graphology';
import type { ContainerGroup } from './container-membership';

const xy = (g: Graph, id: string) => ({
	x: g.getNodeAttribute(id, 'x') as number,
	y: g.getNodeAttribute(id, 'y') as number
});

function moveTo(g: Graph, id: string, x: number, y: number) {
	g.setNodeAttribute(id, 'x', x);
	g.setNodeAttribute(id, 'y', y);
}

/**
 * Re-centre the layout on `focalId`: its direct neighbours on a ring around it, the rest on
 * a ring outside that, half a step turned. The bronnen in `keepPlace` (a netwerk's chosen
 * ones) stay where they are. Returns the bronnen it moved, for the layout to settle.
 */
export function ringAround(g: Graph, focalId: string, keepPlace: ReadonlySet<string>): Set<string> {
	const near = new Set(g.neighbors(focalId));
	const inner: string[] = [];
	const outer: string[] = [];
	g.forEachNode((id) => {
		if (id === focalId || keepPlace.has(id)) return;
		(near.has(id) ? inner : outer).push(id);
	});
	moveTo(g, focalId, 0, 0);
	const innerR = Math.max(120, 60 + Math.sqrt(inner.length) * 30);
	inner.forEach((id, i) => {
		const angle = (i / Math.max(inner.length, 1)) * Math.PI * 2 - Math.PI / 2;
		moveTo(g, id, Math.cos(angle) * innerR, Math.sin(angle) * innerR);
	});
	const outerR = innerR + Math.max(140, Math.sqrt(outer.length) * 30);
	outer.forEach((id, i) => {
		const angle =
			(i / Math.max(outer.length, 1)) * Math.PI * 2 -
			Math.PI / 2 +
			Math.PI / Math.max(inner.length, 1);
		moveTo(g, id, Math.cos(angle) * outerR, Math.sin(angle) * outerR);
	});
	return new Set([...inner, ...outer]);
}

/**
 * Invisible edges that pull a hull's members toward each other in the layout, so the hull
 * is a compact shape instead of a straggle across the canvas: a ring, and past three members
 * a chord to the opposite one. A star from one member left the group loose and stacked
 * every group of a lid on several commissies on that one point. Marked `layoutOnly`: never
 * drawn, never clickable. Takes out the ones of `before` no group needs any more and
 * returns the ones now drawn.
 */
export function syncGroupLinks(
	g: Graph,
	groups: Iterable<ContainerGroup>,
	before: ReadonlySet<string>
): Set<string> {
	const next = new Set<string>();
	const link = (groupId: string, a: string, b: string) => {
		if (a === b) return;
		const [lo, hi] = a < b ? [a, b] : [b, a];
		const edgeId = `anchor:${groupId}:${lo}~${hi}`;
		next.add(edgeId);
		// A simple graph takes one undirected edge between two bronnen: another group's
		// link may tie them already.
		if (!g.hasEdge(edgeId) && !g.hasUndirectedEdge(a, b))
			g.addUndirectedEdgeWithKey(edgeId, a, b, { layoutOnly: true });
	};
	for (const group of groups) {
		const present = [...group.members].filter((id) => g.hasNode(id));
		const n = present.length;
		if (n < 2) continue;
		for (let i = 0; i < n; i++) {
			link(group.id, present[i], present[(i + 1) % n]);
			if (n > 3) link(group.id, present[i], present[(i + Math.floor(n / 2)) % n]);
		}
	}
	for (const id of before) if (!next.has(id) && g.hasEdge(id)) g.dropEdge(id);
	return next;
}

/** Each bron tied to `id` by a drawn line, passing over the links of a hull (`syncGroupLinks`). */
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

const GROUP_GAP = 36;
const GOLDEN_ANGLE = 2.399963229728653;
const groupRadius = (memberCount: number) => Math.max(26, 14 + Math.sqrt(memberCount) * 10);

type Disk = { cx: number; cy: number; r: number; ids: string[] };

/**
 * A ring settles as a loop under ForceAtlas2, and nothing stops two groups from settling on
 * top of each other. So after every burst each group of two or more is packed into a filled
 * disk around its own centroid (a sunflower spiral: a golden-angle turn and a growing radius
 * per member), disks that overlap are pushed apart along the line between their centres,
 * and a bron in no disk that landed in one (a judgment citing a law's article) moves out to
 * a band around it. A Venn diagram, not physics: disjoint groups get disjoint ground.
 *
 * A bron in two groups (a stuk PART_OF a dossier that AMENDS a wet directly) is packed by
 * the largest only; the smaller draws its hull around wherever that leaves it. Returns
 * whether any group was packed.
 */
export function packGroups(g: Graph, groups: Iterable<ContainerGroup>): boolean {
	const eligible = [...groups]
		.filter((group) => group.members.size >= 2)
		.sort((a, b) => b.members.size - a.members.size);
	const primary = new Map<string, string>();
	for (const group of eligible)
		for (const id of group.members)
			if (g.hasNode(id) && !primary.has(id)) primary.set(id, group.id);

	const disks: Disk[] = [];
	for (const group of eligible) {
		const ids = [...group.members].filter((id) => primary.get(id) === group.id);
		const n = ids.length;
		if (n < 2) continue;
		const cx = ids.reduce((sum, id) => sum + xy(g, id).x, 0) / n;
		const cy = ids.reduce((sum, id) => sum + xy(g, id).y, 0) / n;
		const r = groupRadius(n);
		ids.forEach((id, i) => {
			const angle = i * GOLDEN_ANGLE;
			const radius = r * Math.sqrt((i + 0.5) / n);
			moveTo(g, id, cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
		});
		disks.push({ cx, cy, r, ids });
	}
	pushApart(g, disks);
	clearDisks(g, disks);
	return disks.length > 0;
}

function pushApart(g: Graph, disks: Disk[]) {
	const shift = (disk: Disk, dx: number, dy: number) => {
		for (const id of disk.ids) {
			const p = xy(g, id);
			moveTo(g, id, p.x + dx, p.y + dy);
		}
		disk.cx += dx;
		disk.cy += dy;
	};
	for (let pass = 0; pass < 6 && disks.length > 1; pass++) {
		for (let i = 0; i < disks.length; i++) {
			for (let j = i + 1; j < disks.length; j++) {
				const a = disks[i];
				const b = disks[j];
				const dx = b.cx - a.cx;
				const dy = b.cy - a.cy;
				const dist = Math.hypot(dx, dy) || 0.01;
				const minDist = a.r + b.r + GROUP_GAP;
				if (dist >= minDist) continue;
				const move = (minDist - dist) / 2;
				shift(a, (-dx / dist) * move, (-dy / dist) * move);
				shift(b, (dx / dist) * move, (dy / dist) * move);
			}
		}
	}
}

/** A bron in no disk moves out of every disk it landed in, in its own direction from the
 *  centre; a low-discrepancy step spreads those of one direction across the band. */
function clearDisks(g: Graph, disks: Disk[]) {
	const packed = new Set(disks.flatMap((disk) => disk.ids));
	for (const disk of disks) {
		const inside: { id: string; angle: number }[] = [];
		g.forEachNode((id, attrs) => {
			if (packed.has(id)) return;
			const dx = (attrs.x as number) - disk.cx;
			const dy = (attrs.y as number) - disk.cy;
			if (Math.hypot(dx, dy) >= disk.r + GROUP_GAP) return;
			const angle = dx || dy ? Math.atan2(dy, dx) : inside.length * GOLDEN_ANGLE;
			inside.push({ id, angle });
		});
		const band = groupRadius(inside.length);
		inside.forEach(({ id, angle }, i) => {
			const radius = disk.r + GROUP_GAP + band * ((i * 0.618034) % 1);
			moveTo(g, id, disk.cx + Math.cos(angle) * radius, disk.cy + Math.sin(angle) * radius);
		});
	}
}

const DIRECTIONS = 16;
const CLUSTER_OUT = 1.3;

/**
 * A cluster bron stands where it has most room around the focus (ForceAtlas2 put "172
 * uitspraken" on the hull of BW5 and its name under the hull's): of sixteen directions just
 * outside the ring of the focus's other neighbours, the one furthest from any bron.
 */
export function placeClusters(
	g: Graph,
	focus: string,
	clusterIds: readonly string[],
	isCluster: (id: string) => boolean
) {
	const f = xy(g, focus);
	const taken: { x: number; y: number }[] = [];
	g.forEachNode((id, a) => {
		if (id !== focus && !isCluster(id) && !a.anchor)
			taken.push({ x: a.x as number, y: a.y as number });
	});
	const dists = g
		.neighbors(focus)
		.filter((id) => !isCluster(id))
		.map((id) => Math.hypot(xy(g, id).x - f.x, xy(g, id).y - f.y))
		.sort((a, b) => a - b);
	// Just outside the ring of the other neighbours, which ForceAtlas2 sets at one distance.
	const r = dists.length ? dists[Math.floor((dists.length - 1) * 0.9)] * CLUSTER_OUT : 100;
	const room = (x: number, y: number) =>
		taken.reduce((min, t) => Math.min(min, Math.hypot(t.x - x, t.y - y)), Infinity);
	for (const id of clusterIds) {
		if (!g.hasNode(id)) continue;
		let best = { x: f.x - r, y: f.y, room: -1 };
		for (let k = 0; k < DIRECTIONS; k++) {
			const angle = (k / DIRECTIONS) * 2 * Math.PI;
			const x = f.x + Math.cos(angle) * r;
			const y = f.y + Math.sin(angle) * r;
			const free = room(x, y);
			if (free > best.room) best = { x, y, room: free };
		}
		moveTo(g, id, best.x, best.y);
		taken.push(best);
	}
}
