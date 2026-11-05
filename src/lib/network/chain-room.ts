// How much room the layers of the keten take: pure, so the drawing only draws (ChainView.svelte).
import type { ChainLayer } from '$lib/network/chain';

type Rest = Partial<Record<ChainLayer['id'], number>>;
/** A layer's left margin and a bron's room across, as the drawing has them. */
type Room = { left: number; slot: number };

/** How many share a layer's width: in Noemt each has its slot, however many come. */
export const sharing = (l: ChainLayer) => (l.id === 'named' ? 1 : l.nodes.length);

/** The width the layers ask, at least `avail`: each bron and "N andere" a slot. */
export const widthOf = (layers: readonly ChainLayer[], rest: Rest, avail: number, o: Room) =>
	Math.max(
		avail,
		...layers.map((l) => o.left + 24 + (l.nodes.length + (rest[l.id] ? 1 : 0)) * o.slot)
	);

/** The drawing with Noemt, whose last bron and "N andere" may stand past the rest. */
export const fullWidthOf = (
	layers: readonly ChainLayer[],
	rest: Rest,
	place: ReadonlyMap<string, { x: number }>,
	width: number,
	slot: number
) => {
	const named = layers.find((l) => l.id === 'named')?.nodes ?? [];
	const room = slot * (rest.named ? 2 : 1);
	return Math.max(width, ...named.map((k) => (place.get(k.id)?.x ?? 0) + room));
};

/** Labels stacked over a bron push its row down: the heading, pinned, passes over them all. */
export const liftsOf = (layers: readonly ChainLayer[], stack: number) =>
	layers.map((l) => {
		const here = (id: string) => l.nodes.some((n) => n.id === id);
		const most = l.nodes.map((k) => k.parents.filter((p) => p.cite && !here(p.id)).length);
		return stack * Math.max(0, ...most.map((n) => n - 1));
	});
