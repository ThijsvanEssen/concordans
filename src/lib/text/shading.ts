// The arceringen of the reader's bundels in a text (O4): drawn grey (`--wassing`, the pencil)
// with the CSS Custom Highlight API, so the DOM stays as it is and a definition's card, a
// reference's link and a place's click go on working. Every text on a page adds its ranges
// under its own key; the page draws them as one highlight. A browser without the API draws
// none: the bookmark in the margin and the menu of the place still say what is kept.
import type { Annotation, Map, MapItem } from '$lib/map/map';
import { annotationOn, itemKey } from '$lib/map/map';
import type { Hit } from './fragment';

/** The name of the highlight, as the style reads it: `::highlight(arcering)`. */
const NAME = 'arcering';

/** What each text draws, by its own key. */
const drawnBy = new globalThis.Map<object, Range[]>();

/** Whether this browser draws arceringen (Chrome 105, Safari 17.2, Firefox 140). */
const canShade = (): boolean =>
	typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';

/** The ranges a text draws, in place of what it drew before; none takes them away. */
export function draw(owner: object, ranges: Range[]) {
	if (ranges.length) drawnBy.set(owner, ranges);
	else drawnBy.delete(owner);
	if (!canShade()) return;
	const all = [...drawnBy.values()].flat();
	if (all.length) CSS.highlights.set(NAME, new Highlight(...all));
	else CSS.highlights.delete(NAME);
}

/** An arcering as a text shows it: its annotation, the bundel and the item it is kept on, and
 *  where its words are now. */
export type Shading = {
	annotation: Annotation & { fragment: NonNullable<Annotation['fragment']> };
	map: Pick<Map, 'id' | 'naam'>;
	item: MapItem;
	hit: Hit;
};

/** The arceringen of a bron in the bundels: every annotation with a fragment on an item of it. */
export function shadingsOf(maps: readonly Map[], bron: string): Omit<Shading, 'hit'>[] {
	const out: Omit<Shading, 'hit'>[] = [];
	for (const map of maps) {
		const items = map.items.filter((i) => i.id === bron);
		for (const a of map.aantekeningen ?? []) {
			const item = items.find((i) => annotationOn(a, itemKey(i)));
			if (item && a.fragment) out.push({ annotation: { ...a, fragment: a.fragment }, map, item });
		}
	}
	return out;
}

/** The arcering drawn where a point of the page falls, where one is. */
export function shadingAt<T extends { range: Range }>(
	x: number,
	y: number,
	drawn: readonly T[]
): T | null {
	const doc = document as Document & {
		caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
	};
	const pos = doc.caretPositionFromPoint?.(x, y);
	const caret = pos
		? { node: pos.offsetNode, offset: pos.offset }
		: (() => {
				const r = document.caretRangeFromPoint?.(x, y);
				return r ? { node: r.startContainer, offset: r.startOffset } : null;
			})();
	if (!caret) return null;
	// A point at the end of a range is the sign after it: outside.
	return (
		drawn.find(
			(d) =>
				d.range.isPointInRange(caret.node, caret.offset) &&
				!(d.range.endContainer === caret.node && d.range.endOffset === caret.offset)
		) ?? null
	);
}
