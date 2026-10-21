// A selection of words in a reader's text (O4): `use:selection` on the text calls `open` once the
// reader has selected words, with the smallest place that holds them (`data-plaats` on a lid,
// an r.o., an alinea) and their position in its text as the reader shows it (`walkText`, the
// words `placeText` counts: no place's own marker, nothing marked `data-geen-tekst`). With a
// mouse or keys at once; on touch once the finger has let go and the selection rests (the
// handles move it on), and the menu opens under it past the phone's own bar there (iOS 26);
// while a finger is down nothing scrolls and no menu opens, or iOS would drag the selection
// on (A92). The DOM is never changed: the words are drawn with the CSS Custom Highlight API
// (shading.ts).
import type { Action } from 'svelte/action';

/** The attribute that names a place: its anchor, `lid-2`, `rov-5.1`, `p-360a090c`. */
export const PLACE = 'data-plaats';

/** What is no word of a place's text: its marker (`1.`, `a.`), a note's marker, a line beside it. */
const NOT_TEXT = '.plaats-marker, [data-geen-tekst]';

/** Elements whose text stands apart from the text before it: one space between. */
const BLOCK = /^(P|DIV|LI|TD|TH|TR|TABLE|THEAD|TBODY|UL|OL|BLOCKQUOTE|SECTION|H[1-6]|BR)$/;

const WHITE = /[\s\u00a0\u202f]/;

/** The text of an element as the reader reads it, its spaces folded, with each sign's node. */
type Walk = { text: string; at: [Text, number][] };

/** The block an element's text stands in. */
function blockOf(node: Node, root: Element): Element {
	for (let el = node.parentElement; el && el !== root; el = el.parentElement)
		if (BLOCK.test(el.tagName)) return el;
	return root;
}

/**
 * The text of a place as the reader shows it, its spaces folded and trimmed, a space between
 * two blocks: the text `placeText` gives for the same place. Each sign with its node.
 */
export function walkText(root: Element): Walk {
	let text = '';
	const at: [Text, number][] = [];
	let gap = false;
	let block: Element | null = null;
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (n) =>
			n.parentElement?.closest(NOT_TEXT) && root.contains(n.parentElement.closest(NOT_TEXT))
				? NodeFilter.FILTER_REJECT
				: NodeFilter.FILTER_ACCEPT
	});
	for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
		const b = blockOf(n, root);
		if (block && b !== block) gap = true;
		block = b;
		const s = n.data;
		for (let i = 0; i < s.length; i++) {
			if (WHITE.test(s[i])) {
				gap = true;
				continue;
			}
			if (gap && text) {
				text += ' ';
				at.push([n, i]);
			}
			gap = false;
			text += s[i];
			at.push([n, i]);
		}
	}
	return { text, at };
}

/** A DOM range over the signs `[start, end)` of a walked text; null for none. */
export function rangeOf(walk: Walk, start: number, end: number): Range | null {
	if (start < 0 || end > walk.text.length || start >= end) return null;
	const range = document.createRange();
	const [a, i] = walk.at[start];
	const [b, j] = walk.at[end - 1];
	range.setStart(a, i);
	range.setEnd(b, j + 1);
	return range;
}

/** The sign of a walked text a DOM boundary point stands before: its length past the end. */
function offsetOf(walk: Walk, node: Node, offset: number): number {
	const probe = document.createRange();
	probe.setStart(node, offset);
	probe.collapse(true);
	const k = walk.at.findIndex(([n, i]) => probe.comparePoint(n, i) >= 0);
	return k === -1 ? walk.text.length : k;
}

/**
 * Where the signs `[start, end)` of one text stand in another of the same words: the same
 * place where both agree, else the same words nearest to it; null where the other lacks them.
 * The reader's text and `placeText` agree but where a table joins its cells.
 */
export function carry(
	from: string,
	to: string,
	start: number,
	end: number
): [number, number] | null {
	if (from === to) return [start, end];
	const words = from.slice(start, end);
	let best = -1;
	for (let i = to.indexOf(words); i !== -1; i = to.indexOf(words, i + 1))
		if (best === -1 || Math.abs(i - start) < Math.abs(best - start)) best = i;
	return best === -1 ? null : [best, best + words.length];
}

/** The place that holds a node: the nearest `data-plaats` within the text. */
const placeEl = (node: Node, root: HTMLElement): HTMLElement | null => {
	const el = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(
		`[${PLACE}]`
	);
	return el && root.contains(el) ? el : null;
};

/** A selection in the text: its range, its words, and its place where one holds it all. */
export type TextSelection = {
	range: Range;
	/** The words selected, as the browser gives them. */
	text: string;
	/** The smallest place that holds it; null where it reaches past the text (two articles). */
	place: { id: string; el: HTMLElement; start: number; end: number; walk: Walk } | null;
	/** Made with a finger: the phone shows its own bar under it. */
	touch: boolean;
};

/** The selection of the page as it stands in `root`; null where none starts in it. */
export function selectionIn(root: HTMLElement, touch = false): TextSelection | null {
	const sel = typeof getSelection === 'function' ? getSelection() : null;
	if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
	const range = sel.getRangeAt(0);
	const text = sel.toString();
	if (!text.trim() || !root.contains(range.startContainer)) return null;
	if (!root.contains(range.endContainer)) return { range, text, place: null, touch };
	const el = placeEl(range.commonAncestorContainer, root);
	if (!el) return { range, text, place: null, touch };
	const walk = walkText(el);
	const start = offsetOf(walk, range.startContainer, range.startOffset);
	const end = offsetOf(walk, range.endContainer, range.endOffset);
	return end > start
		? { range, text, place: { id: el.getAttribute(PLACE)!, el, start, end, walk }, touch }
		: null;
}

/** The words selected let go: once kept, the arcering shows in their place. */
export const clearSelection = () => getSelection()?.removeAllRanges();

/** Whether an element scrolls its content on its own: a column. */
const scrolls = (el: Element) =>
	/auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight;

/**
 * Words selected on a phone up to a fifth of the screen, where they stand below its upper
 * part: the menu opens below them (past the phone's bar there), with room for it. In the
 * column the text scrolls in, else the page.
 */
export function wordsUp(range: Range, from: Element) {
	const r = range.getBoundingClientRect();
	if (r.bottom <= innerHeight * 0.4) return;
	const by = r.top - innerHeight * 0.2;
	let el: Element | null = from.parentElement;
	while (el && el !== document.body && !scrolls(el)) el = el.parentElement;
	if (el && el !== document.body) el.scrollBy({ top: by, behavior: 'instant' });
	else scrollBy({ top: by, behavior: 'instant' });
}

/** Where a selection stands, in its place's text: the same words set again open no second
 *  menu, however the browser gives their nodes back. */
const keyOf = (s: TextSelection) =>
	s.place ? `${s.place.id}:${s.place.start}:${s.place.end}` : `:${s.text}`;

/** How long a selection on touch rests, the finger off the glass, before its menu opens. */
const REST_MS = 400;
/** How long after its menu opens a selection on touch is set again: by then the menu holds
 *  the focus and iOS has stopped drawing the selection, its handles too. */
const REDRAW_MS = 150;

type Params = {
	open: (s: TextSelection) => void;
	/** Closes the menu: the reader moves the selection on with a finger (A92). */
	close?: () => void;
	off?: boolean;
};

export const selection: Action<HTMLElement, Params> = (node, params) => {
	let current = params;
	let down = false;
	let touch = false;
	/** A finger on the glass: nothing scrolls and no menu opens until it lets go (A92). */
	let held = false;
	/** The selection moved on touch since its menu last opened. */
	let moved = false;
	/** Where the selection stood when its menu last opened on touch, till a finger is down
	 *  again: the words set again then open no second menu. */
	let opened: string | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let redraw: ReturnType<typeof setTimeout> | undefined;
	const check = () => {
		clearTimeout(timer);
		clearTimeout(redraw);
		moved = false;
		if (current.off) return;
		const s = selectionIn(node, touch);
		if (!s) return;
		// The words set again once their menu opened: it is open already.
		if (touch && opened === keyOf(s)) return;
		opened = touch ? keyOf(s) : null;
		current.open(s);
		if (!touch) return;
		const range = s.range.cloneRange();
		redraw = setTimeout(() => {
			const sel = getSelection();
			sel?.removeAllRanges();
			sel?.addRange(range);
		}, REDRAW_MS);
	};
	// After the click that ends a drag: that click is the text's, the menu opens after it.
	const afterClick = () => {
		clearTimeout(timer);
		timer = setTimeout(check, 0);
	};
	const onDown = (e: PointerEvent) => {
		touch = e.pointerType !== 'mouse';
		down = e.pointerType === 'mouse';
	};
	const onUp = (e: PointerEvent) => {
		if (e.pointerType !== 'mouse') return;
		down = false;
		afterClick();
	};
	const onKey = (e: KeyboardEvent) => {
		if (e.shiftKey || e.key === 'Shift') afterClick();
	};
	// A finger down, on the text or a handle of its selection: a scroll or a menu now would
	// drag the selection on under it (iOS), so both wait for it to let go.
	const onTouchStart = () => {
		touch = true;
		held = true;
		opened = null;
		clearTimeout(timer);
		clearTimeout(redraw);
	};
	const onTouchEnd = (e: TouchEvent) => {
		if (e.touches.length) return;
		held = false;
		clearTimeout(timer);
		if (moved) timer = setTimeout(check, REST_MS);
	};
	// On touch the handles move the selection on: its menu closes while they do, and opens
	// again once the finger has let go and the selection rests.
	const onChange = () => {
		if (down || !touch) return;
		clearTimeout(timer);
		if (held) {
			if (!current.off && selectionIn(node, true)) {
				moved = true;
				current.close?.();
			}
			return;
		}
		moved = true;
		timer = setTimeout(check, REST_MS);
	};
	node.addEventListener('pointerdown', onDown);
	addEventListener('pointerup', onUp);
	node.addEventListener('keyup', onKey);
	document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
	document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
	document.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });
	document.addEventListener('selectionchange', onChange);
	return {
		update(next) {
			current = next;
		},
		destroy() {
			clearTimeout(timer);
			clearTimeout(redraw);
			node.removeEventListener('pointerdown', onDown);
			removeEventListener('pointerup', onUp);
			node.removeEventListener('keyup', onKey);
			document.removeEventListener('touchstart', onTouchStart, { capture: true });
			document.removeEventListener('touchend', onTouchEnd, { capture: true });
			document.removeEventListener('touchcancel', onTouchEnd, { capture: true });
			document.removeEventListener('selectionchange', onChange);
		}
	};
};
