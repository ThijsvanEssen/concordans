// Where the card of a cluster stands over the canvas of the werkplek: beside the pointer,
// clear of what floats over the canvas (the zoom). The card of a bron has a strip of its own.

type Point = { x: number; y: number };

/** Between a card and the edge of the canvas. */
const MARGIN = 8;

/** The card of a cluster: its width, and its gap to the pointer. */
export const CLUSTER_CARD = { w: 280, gap: 16 };

/** Where the card of a cluster first stands, before it is measured and placed (`placeCard`). */
export function clusterCardAt(at: Point, canvasWidth: number): Point {
	const { w, gap } = CLUSTER_CARD;
	return {
		x: at.x + gap + w < canvasWidth ? at.x + gap : Math.max(MARGIN, canvasWidth - w - MARGIN),
		y: Math.max(MARGIN, at.y - gap)
	};
}

export type Box = { x: number; y: number; w: number; h: number };

const overlap = (a: Box, b: Box) =>
	Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
	Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Where a cluster's card stands within the canvas (`width` by `height`): beside the
 * pointer, right or left of it, and else beside or below whatever floats over the
 * canvas (the panel Netwerk, the zoom buttons, the legenda), so it covers none of them.
 * Where every place covers something, the place that covers least.
 */
export function placeCard(
	at: { x: number; y: number },
	card: { w: number; h: number },
	canvas: { width: number; height: number },
	obstacles: Box[],
	gap = CLUSTER_CARD.gap,
	margin = MARGIN
): { x: number; y: number } {
	const clamp = (x: number, y: number): Box => ({
		x: Math.max(margin, Math.min(x, canvas.width - card.w - margin)),
		y: Math.max(margin, Math.min(y, canvas.height - card.h - margin)),
		...card
	});
	const candidates = [
		clamp(at.x + gap, at.y - gap),
		clamp(at.x - gap - card.w, at.y - gap),
		...obstacles.flatMap((o) => [
			clamp(o.x - gap - card.w, at.y - gap),
			clamp(at.x + gap, o.y + o.h + gap),
			clamp(at.x - gap - card.w, o.y + o.h + gap)
		])
	];
	const covered = (b: Box) => obstacles.reduce((sum, o) => sum + overlap(b, o), 0);
	const best = candidates.reduce((a, b) => (covered(b) < covered(a) ? b : a));
	return { x: best.x, y: best.y };
}
