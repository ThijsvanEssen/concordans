// What the lanes do with the articles a dossier changes (GET /api/dossiers/{number}/changed-articles)
// and with the card that lies over them. Pure: LanesView draws it.
import type { Schema } from '$lib/api/types';
import { dossierNumberOf } from '$lib/bron/describe';
import type { LawChange } from './scene';
import type { GraphNode } from './types';

/** The air kept around what is scrolled into view. */
const SCROLL_MARGIN = 16;

/** The marker of a changed wet, around (0, 0): a form, closed or open, so not colour alone. */
export const CHANGED_MARK = 'M0 -3.5 L4 3.5 H-4 Z';
/** Its head and legend, and what a tooltip says of the wet. */
export const LAW_CHANGE_WORDS: Record<LawChange, { head: string; says: string }> = {
	enacted: { head: 'Gewijzigd', says: 'gewijzigd' },
	proposed: { head: 'Voorgesteld', says: 'wijziging voorgesteld' }
};

/** A dossier's number as its node's key writes it: `21501-02` is `21501_02`. */
const keyOfNumber = (number: string) => number.toLowerCase().replace(/[^a-z0-9]+/g, '_');

/**
 * The number the API knows a dossier by, as a bron of this dossier carries it (a bron in the hull
 * may belong to another dossier too); else read from its key.
 */
export function laneDossierNumber(
	id: string,
	members: readonly string[],
	nodeOf: (id: string) => GraphNode | undefined
): string {
	const key = id.replace(/^dossiers\//, '');
	for (const m of members) {
		const number = dossierNumberOf(nodeOf(m)?.raw?.props);
		if (number && keyOfNumber(number) === key) return number;
	}
	return key.replaceAll('_', '-').toUpperCase();
}

/** Every article the dossier changes, by its id, with its number. */
export function changedNumbers(
	data: Schema<'DossierChangedArticlesResponse'>
): Map<string, string> {
	return new Map(
		data.laws.flatMap((l) =>
			l.changes.map((c) => [c.article.id, c.article.article_number?.trim() ?? ''] as const)
		)
	);
}

/** Of a row of a hull, the changed articles first: only so many squares are drawn. */
export const changedFirst = (members: readonly string[], changed: ReadonlyMap<string, string>) =>
	changed.size === 0
		? members
		: [...members.filter((m) => changed.has(m)), ...members.filter((m) => !changed.has(m))];

/** How wide a digit of a number is drawn, about. */
const DIGIT = 6;

/**
 * The changed squares whose number fits over them: left to right on each line, a number only where
 * the one before it has ended. The others keep their ring; the Zijpaneel names them all.
 */
export function numberedSquares(
	members: readonly string[],
	changed: ReadonlyMap<string, string>,
	perLine: number,
	step: number
): Set<string> {
	const out = new Set<string>();
	let free = 0;
	members.forEach((m, i) => {
		const x = (i % perLine) * step;
		if (i % perLine === 0) free = 0;
		const number = changed.get(m);
		if (!number || x < free) return;
		out.add(m);
		free = x + number.length * DIGIT + DIGIT;
	});
	return out;
}

type Box = { left: number; right: number; top: number; bottom: number };

/**
 * How far a field scrolls so that what is marked stands in view, beside the card over it: a card at
 * the right narrows the field, a sheet at the foot lowers it. Too wide for what is left: its start.
 */
export function scrollToShow(unit: Box, field: Box, card: Box | null): { x: number; y: number } {
	const atFoot = !!card && card.left <= field.left + 1;
	const right = card && !atFoot ? Math.min(field.right, card.left) : field.right;
	const bottom = card && atFoot ? Math.min(field.bottom, card.top) : field.bottom;
	const along = (start: number, end: number, from: number, to: number) => {
		if (start >= from && end <= to) return 0;
		return end - start > to - from || start < from ? start - from : end - to;
	};
	return {
		x: along(unit.left, unit.right, field.left + SCROLL_MARGIN, right - SCROLL_MARGIN),
		y: along(unit.top, unit.bottom, field.top + SCROLL_MARGIN, bottom - SCROLL_MARGIN)
	};
}

/** The card over the field: the Zijpaneel or the card of a marked bron, on a phone a sheet at the foot. */
const cardOver = (field: HTMLElement) =>
	(
		field.parentElement?.querySelector('.lane-card') ??
		field.closest('.graph-view')?.querySelector('.strook--kaart.is-open')
	)?.getBoundingClientRect() ?? null;

/** Does it stand at the right of the field? A sheet at the foot takes no column. */
const atSide = (card: DOMRect | null, field: DOMRect) => !!card && card.left > field.left + 1;

/** How wide the card at the side of the field is: the drawing makes room for it. */
export function cardWidth(field: HTMLElement) {
	const card = cardOver(field);
	return card && atSide(card, field.getBoundingClientRect()) ? card.width : 0;
}

const around = (rects: DOMRect[]) =>
	DOMRect.fromRect({
		x: Math.min(...rects.map((r) => r.left)),
		y: Math.min(...rects.map((r) => r.top)),
		width: Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)),
		height: Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top))
	});

/** What stands for the bron or dossier chosen on the lanes: a card opened it, a card's end returns to it. */
export const chosenOn = (field: HTMLElement, unit: string) =>
	field.querySelector<SVGElement>('.member.is-active') ??
	field.querySelector<SVGElement>('.tile.is-open') ??
	field.querySelector<SVGElement>(`[data-unit="${CSS.escape(unit)}"]`);

/**
 * Scrolls the field so that the unit marked (or its bron in it) stands beside the card over it, the
 * units at the other end of its lines with it (`linked`, the most wanted last) as far as they fit:
 * what is chosen is seen with the wet its line ends at.
 */
export function showBeside(field: HTMLElement, unit: string, linked: readonly string[] = []) {
	const el = chosenOn(field, unit);
	if (!el) return;
	const box = field.getBoundingClientRect();
	const card = cardOver(field);
	const room = (atSide(card, box) ? card!.left : box.right) - box.left - 2 * SCROLL_MARGIN;
	// The wet an article stands in is the last to give way; a tile needs only itself of its hull.
	const others = [...linked, ...(el.matches('.member') ? [unit] : [])].flatMap(
		(id) => field.querySelector(`[data-unit="${CSS.escape(id)}"]`)?.getBoundingClientRect() ?? []
	);
	// All of them; else without the first, and so on, down to the unit itself.
	const own = el.getBoundingClientRect();
	let target = own;
	for (let from = 0; from <= others.length; from++) {
		const all = around([own, ...others.slice(from)]);
		if (all.width <= room) {
			target = all;
			break;
		}
	}
	const { x } = scrollToShow(target, box, card);
	// Lines reach far up and down: only sideways for them, the height is the unit's own.
	const up = scrollToShow(own, box, card).y;
	field.scrollBy(x, up);
}
