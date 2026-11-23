// How much room the layers of the keten take: pure, so the drawing only draws (ChainView.svelte).
import type { ChainLayer } from '$lib/network/chain';

type Rest = Partial<Record<ChainLayer['id'], number>>;
/** A layer's left margin and a bron's room across, as the drawing has them. */
type Room = { left: number; slot: number };

/** The width the layers ask, at least `avail`: each bron and "N andere" a slot; what came late stands beyond it. */
export const widthOf = (layers: readonly ChainLayer[], rest: Rest, avail: number, o: Room) =>
	Math.max(
		avail,
		...layers.map(
			(l) => o.left + 24 + (l.nodes.filter((k) => !k.late).length + (rest[l.id] ? 1 : 0)) * o.slot
		)
	);

/** What stands in a layer, without what came late: the room of a name does not change for it. */
export const crowd = (l: ChainLayer) => Math.max(1, l.nodes.filter((k) => !k.late).length);

/** A row that awaits the wetten that name the law, or holds them, keeps its room (B109). */
export const keeps = (l: ChainLayer) => !!l.awaiting || l.nodes.some((k) => k.late);

/** The drawing with what came late, whose last bron and "N andere" may stand past the rest. */
export const fullWidthOf = (
	layers: readonly ChainLayer[],
	rest: Rest,
	place: ReadonlyMap<string, { x: number }>,
	width: number,
	slot: number
) =>
	Math.max(
		width,
		...layers.flatMap((l) =>
			l.nodes
				.filter((k) => k.late)
				.map((k) => (place.get(k.id)?.x ?? 0) + slot * (rest[l.id] ? 2 : 1))
		)
	);

/** Labels stacked over a bron push its row down: the heading, pinned, passes over them all. */
export const liftsOf = (layers: readonly ChainLayer[], stack: number) =>
	layers.map((l) => {
		const here = (id: string) => l.nodes.some((n) => n.id === id);
		const most = l.nodes.map((k) => k.parents.filter((p) => p.cite && !here(p.id)).length);
		return stack * Math.max(0, ...most.map((n) => n - 1));
	});

/** The measures of a row, in px: its least height, its label's drop, a line of a name, a label stacked. */
type Row = { row: number; drop: number; line: number; stack: number };

/**
 * How high a layer is: its least, or more where a name runs over more lines or a wet has two
 * labels beside the law; a row that keeps its room (`keeps`) has that of three lines and a label.
 */
export const rowHeight = (l: ChainLayer, lines: (id: string) => number, m: Row) => {
	const most = Math.max(1, ...l.nodes.map((k) => lines(k.id)));
	const here = (id: string) => l.nodes.some((n) => n.id === id);
	const two = l.nodes.some((k) => k.parents.filter((p) => p.cite && here(p.id)).length > 1);
	const asked = Math.max(m.row, m.drop + 24 + m.line * (most - 1) + 58) + (two ? m.stack + 4 : 0);
	return keeps(l) ? Math.max(asked, m.drop + 24 + m.line * 2 + 58 + m.stack + 4) : asked;
};
