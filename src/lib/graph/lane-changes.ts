// What the lanes do with the articles a dossier changes (GET /api/dossiers/{number}/changed-articles)
// and with the card that lies over them. Pure: LanesView draws it.
import type { Schema } from '$lib/api/types';
import { dossierNumberOf } from '$lib/bron/describe';
import type { GraphNode } from './types';

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
	const MARGIN = 16;
	return {
		x: along(unit.left, unit.right, field.left + MARGIN, right - MARGIN),
		y: along(unit.top, unit.bottom, field.top + MARGIN, bottom - MARGIN)
	};
}

/** Scrolls the field so that the unit marked (or its bron in it) stands beside the card over it. */
export function showBeside(field: HTMLElement, unit: string) {
	const el =
		field.querySelector('.member.is-active') ??
		field.querySelector(`[data-unit="${CSS.escape(unit)}"]`);
	if (!el) return;
	const card =
		field.parentElement?.querySelector('.lane-card') ??
		field.closest('.graph-view')?.querySelector('.strook--kaart.is-open');
	const { x, y } = scrollToShow(
		el.getBoundingClientRect(),
		field.getBoundingClientRect(),
		card?.getBoundingClientRect() ?? null
	);
	field.scrollBy(x, y);
}
