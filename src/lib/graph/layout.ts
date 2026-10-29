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
const CENTRE_GAP = 220;
/** Chosen bronnen beyond this many stand in two rows, so their discs and names keep apart. */
const ONE_ROW = 3;
const ROW_OFFSET = 70;
const RING = 220;
const RING_STEP = 90;
/** The room of one bron along a ring, so names have space. */
const ARC = 70;

/** Between the members of one hull, centre to centre. */
const MEMBER_GAP = 60;
/** Air between a hull's disc (its members plus the margin) and the middle, and what is chosen there. */
const HULL_CLEARANCE = 48;
/** A member of a chosen bron's hull stands this far from that bron. */
const SATELLITE = 76;

/**
 * The radial order of the canvas. `centre`: the chosen bronnen, or the one bron the canvas is
 * drawn around. `groupOf` names a bron's sector (its kind), `groups` their order around the
 * circle, `compare` the order inside a sector. A sector takes a share of the circle as large as
 * its bronnen; a full ring sends the rest to the next one out.
 *
 * `hullOf` names the hull a bron stands in (Netwerkcanvas: a disc around what belongs
 * together). Its members stand together: around the chosen bron of that hull when it has one,
 * else as one place on the ring, packed in a small circle.
 */
export function radialLayout(
	g: Graph,
	centre: readonly string[],
	groupOf: (id: string) => string,
	groups: readonly string[],
	compare: (a: string, b: string) => number,
	hullOf: (id: string) => string | null = () => null,
	holds: (hull: string, id: string) => boolean = () => false
): void {
	const present = centre.filter((id) => g.hasNode(id));
	// A chosen hull (a wet, a dossier) is its members: its anchor stands on a chosen member.
	const anchorOn = new Map<string, string>();
	for (const id of present) {
		if (!g.getNodeAttribute(id, 'anchor')) continue;
		const h = hullOf(id);
		const own = h && present.find((o) => o !== id && !anchorOn.has(o) && holds(h, o));
		if (own) anchorOn.set(id, own);
	}
	const mids = present.filter((id) => !anchorOn.has(id));
	// Side by side; beyond three, in two rows, so no name stands on another's disc.
	const rows = mids.length > ONE_ROW;
	const gap = rows ? CENTRE_GAP * 0.6 : CENTRE_GAP;
	mids.forEach((id, i) =>
		moveTo(
			g,
			id,
			(i - (mids.length - 1) / 2) * gap,
			rows ? (i % 2 === 0 ? -ROW_OFFSET : ROW_OFFSET) : 0
		)
	);
	const standOn = (id: string): string => (anchorOn.has(id) ? standOn(anchorOn.get(id)!) : id);
	for (const anchor of anchorOn.keys()) {
		const on = standOn(anchor);
		moveTo(g, anchor, g.getNodeAttribute(on, 'x'), g.getNodeAttribute(on, 'y'));
	}
	const inner = RING + ((mids.length - 1) * gap) / 2 + (rows ? ROW_OFFSET : 0);
	// The hulls with a chosen member: their other members circle that member.
	const chosenIn = new Map<string, string>();
	for (const id of mids) {
		const h = hullOf(id);
		if (h && !chosenIn.has(h)) chosenIn.set(h, id);
	}
	const satellites = new Map<string, string[]>();
	// One place on the ring per bron, or per hull: its members together.
	const per = new Map<string, string[][]>();
	const slotOf = new Map<string, string[]>();
	g.forEachNode((id) => {
		if (present.includes(id)) return;
		const h = hullOf(id);
		const host = h ? chosenIn.get(h) : undefined;
		if (host) {
			satellites.set(host, [...(satellites.get(host) ?? []), id]);
			return;
		}
		if (h && slotOf.has(h)) {
			slotOf.get(h)!.push(id);
			return;
		}
		const slot = [id];
		if (h) slotOf.set(h, slot);
		const k = groupOf(id);
		per.set(k, [...(per.get(k) ?? []), slot]);
	});
	for (const [host, ids] of satellites) {
		const x = g.getNodeAttribute(host, 'x') as number;
		const y = g.getNodeAttribute(host, 'y') as number;
		ids.sort(compare).forEach((id, i) => {
			// From below round (sigma's y points up): the top of the disc stays free for its name.
			const a = -Math.PI / 2 + (i / ids.length) * Math.PI * 2;
			moveTo(g, id, x + Math.cos(a) * SATELLITE, y + Math.sin(a) * SATELLITE);
		});
	}
	const order = [
		...groups.filter((k) => per.has(k)),
		...[...per.keys()].filter((k) => !groups.includes(k))
	];
	/** How many places of the ring a slot takes: a hull as wide as its circle. */
	// A hull takes a place of air beside it more: its margin and its pill (Thijs, 27 Oct: calmer).
	const width = (slot: string[]) =>
		slot.length > 1 || g.getNodeAttribute(slot[0], 'anchor')
			? 2 + Math.ceil(packRadius(slot.length) / (ARC / 2))
			: 1;
	const total = [...per.values()].reduce(
		(n, slots) => n + slots.reduce((m, s) => m + width(s), 0),
		0
	);
	if (!total) return;
	let start = -Math.PI / 2;
	for (const k of order) {
		const slots = per
			.get(k)!
			.map((s) => s.sort(compare))
			.sort((a, b) => compare(a[0], b[0]));
		const units = slots.reduce((m, s) => m + width(s), 0);
		const span = (units / total) * Math.PI * 2;
		let placed = 0;
		let ring = 0;
		while (placed < slots.length) {
			const r = inner + ring * RING_STEP;
			const room = Math.max(1, Math.floor((span * r) / ARC));
			const these: string[][] = [];
			let used = 0;
			while (placed + these.length < slots.length) {
				const w = width(slots[placed + these.length]);
				if (these.length > 0 && used + w > room) break;
				these.push(slots[placed + these.length]);
				used += w;
			}
			let at = 0;
			for (const slot of these) {
				const w = width(slot);
				const angle = start + ((at + w / 2) / used) * span;
				at += w;
				// A hull's disc never reaches the middle, where the chosen bronnen and their hulls stand
				// (a dossier of many stukken, itself a bron on the ring, would close round the wet).
				const out = Math.max(r, inner + packRadius(slot.length) + HULL_CLEARANCE);
				placeSlot(g, slot, Math.cos(angle) * out, Math.sin(angle) * out);
			}
			placed += these.length;
			ring++;
		}
		start += span;
	}
}

/** The radius of the circle `n` members of one hull are packed in. */
const packRadius = (n: number) => (n <= 1 ? 0 : (n * MEMBER_GAP) / (2 * Math.PI) + MEMBER_GAP / 2);

/** A bron, or a hull's members in a small circle (its anchor in the middle). */
function placeSlot(g: Graph, slot: string[], x: number, y: number) {
	const drawn = slot.filter((id) => !g.getNodeAttribute(id, 'anchor'));
	for (const id of slot) if (g.getNodeAttribute(id, 'anchor')) moveTo(g, id, x, y);
	if (drawn.length === 1) return moveTo(g, drawn[0], x, y);
	const r = packRadius(drawn.length) - MEMBER_GAP / 2;
	drawn.forEach((id, i) => {
		const a = -Math.PI / 2 + (i / drawn.length) * Math.PI * 2;
		moveTo(g, id, x + Math.cos(a) * r, y + Math.sin(a) * r);
	});
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
