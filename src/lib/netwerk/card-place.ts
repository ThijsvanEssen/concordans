// Where the cards over the network stand: the card of a bron beside it, the card of a
// cluster clear of what floats over the canvas, and the Legenda under the panel Netwerk,
// folding one of the two where the canvas has no height for both.
import { passenSamen, type Zwevend } from '$lib/stores/zwevend';

type Point = { x: number; y: number };
type Size = { width: number; height: number };

/** Between a card and the edge of the canvas. */
const MARGIN = 8;

/** The card of a bron: its room, and its gap to the bron. */
const BRON_CARD = { w: 360, h: 240, gap: 20 };

/**
 * Where the card of a bron stands: beside the bron at `at`, right of it or else left, not
 * loose in a corner; in a narrow network (beside the reader) as wide as the network allows.
 */
export function cardBeside(at: Point, canvas: Size): Point {
	const w = Math.min(BRON_CARD.w, canvas.width - 2 * MARGIN);
	const x =
		at.x + BRON_CARD.gap + w < canvas.width - MARGIN
			? at.x + BRON_CARD.gap
			: Math.max(MARGIN, Math.min(at.x - BRON_CARD.gap - w, canvas.width - w - MARGIN));
	const y = Math.min(
		Math.max(MARGIN, at.y - 40),
		Math.max(MARGIN, canvas.height - BRON_CARD.h - MARGIN)
	);
	return { x, y };
}

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

/** The panel Netwerk as it stands over the canvas, measured. */
type PanelBox = { top: number; left: number; width: number; height: number };

/** Where the Legenda stands, and how high it may grow. */
type LegendPlace = { top: number; right: number; width: number; max: number };

/**
 * The Legenda under the panel Netwerk, as wide as it and on its right edge (Thijs, 10 Oct:
 * "legenda en netwerk onder elkaar"); without the panel, in the corner. `card` is the cards'
 * width and edge (--paneel-breed, --paneel-rand).
 */
export function legendPlace(
	host: Size,
	panel: PanelBox | null,
	card: { width: number; edge: number }
): LegendPlace {
	const top = panel ? panel.top + panel.height + 8 : card.edge;
	// A folded panel is narrower: the Legenda keeps the cards' width.
	const right = panel ? host.width - (panel.left + panel.width) : card.edge;
	return {
		top,
		right,
		width: Math.min(Math.max(panel?.width ?? 0, card.width), host.width - 2 * right),
		max: Math.max(0, host.height - top - card.edge)
	};
}

/** The room a folded card needs beyond what it measured open, before it opens again. */
const SLACK = 48;

/**
 * Which card folds, or whether the folded one opens again: with both open and no height for
 * them, the one not opened last folds; a card folded for want of room opens again once
 * both fit with room to spare (measured open and remembered, the heights differ by a few
 * pixels, and without that margin the cards folded and opened each other without end).
 */
export function foldStep(s: {
	height: number;
	panel: { open: boolean; height: number } | null;
	legend: { open: boolean; height: number };
	folded: Zwevend | null;
	lastOpened: Zwevend | null;
	/** Each card's height when it last stood open. */
	openHeights: Partial<Record<Zwevend, number>>;
}): { fold: Zwevend } | 'unfold' | null {
	const panelOpen = !!s.panel?.open;
	const panelHeight = s.panel?.height ?? 0;
	if (panelOpen && s.legend.open && !passenSamen(panelHeight, s.legend.height, s.height))
		return { fold: s.lastOpened === 'legenda' ? 'netwerk' : 'legenda' };
	const roomy = s.height - SLACK;
	if (s.folded === 'legenda' && passenSamen(panelHeight, s.openHeights.legenda ?? Infinity, roomy))
		return 'unfold';
	if (
		s.folded === 'netwerk' &&
		passenSamen(s.openHeights.netwerk ?? Infinity, s.legend.height, roomy)
	)
		return 'unfold';
	return null;
}
