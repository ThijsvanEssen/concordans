// The app takes the reader's column over from the first paint (paint.ts) without a step to
// be seen (besluit 31): the paint stays over the app until the app's reader has the bron's
// text (ReaderFrame) and its head has come in full, so its text stands where the paint's
// does; then it goes, its scroll handed to the reader. Where the app's column does not stand
// where the paint's does, the paint goes as soon as the column is there; and it goes at the
// first touch, click or key outside its text (a tab, the menu, the search), at the first step
// to another address, and after a while in any case.

/** How long the paint waits for the app's reader at most. */
const WAIT_MS = 15_000;
/** How long the paint waits for the app's column to stand in its place. */
const COLUMN_MS = 8_000;
/** How long, once the reader has its text, the paint waits for its head to come in full. */
const HEAD_MS = 4_000;
/** The keys that read the paint's text: they leave it standing. */
const READING_KEYS = new Set([
	'ArrowUp',
	'ArrowDown',
	'PageUp',
	'PageDown',
	'Home',
	'End',
	' ',
	'Shift',
	'Control',
	'Alt',
	'Meta'
]);

let done: ((reason: string) => void) | null = null;
let ready: (() => void) | null = null;

/** Whether two boxes stand in the same place, to the pixel. */
const samePlace = (a: DOMRect, b: DOMRect) =>
	Math.abs(a.left - b.left) < 1 &&
	Math.abs(a.top - b.top) < 1 &&
	Math.abs(a.width - b.width) < 1 &&
	Math.abs(a.height - b.height) < 1;

/** How far down the page an element stands, whatever the reader scrolled: in the viewport,
 *  with what its column (.reader-frame) and its reading view (.explore-read) scrolled. */
function depth(el: HTMLElement): number {
	let top = el.getBoundingClientRect().top;
	for (const scroller of ['.reader-frame', '.explore-read'])
		top += el.closest(scroller)?.scrollTop ?? 0;
	return top;
}

/** Called as the app starts: from here the paint waits for the app's reader. */
export function startTakeover(doc: Document) {
	const frame = doc.getElementById('first-paint');
	const lezer = frame?.querySelector<HTMLElement>('.col--reader');
	if (!frame || !lezer) return;
	/** The app's own element, not the paint's: the paint wears the app's classes. */
	const own = (selector: string) =>
		[...doc.querySelectorAll<HTMLElement>(selector)].find((el) => !frame.contains(el)) ?? null;
	let raf = 0;
	const until = performance.now() + COLUMN_MS;
	// The app's column of the reader: once it is there, the rest of the app shows through.
	const look = () => {
		const col = own('.explore-graph--with-reader > .col--reader');
		if (col && col.getBoundingClientRect().width > 0) {
			if (samePlace(col.getBoundingClientRect(), lezer.getBoundingClientRect()))
				frame.classList.add('ev--app');
			else releaseFirstPaint('column');
			return;
		}
		if (performance.now() > until) releaseFirstPaint('timeout');
		else raf = requestAnimationFrame(look);
	};
	raf = requestAnimationFrame(look);
	const outside = (e: Event) => {
		if (!(e.target instanceof Node) || !lezer.contains(e.target)) releaseFirstPaint('tap');
	};
	const key = (e: KeyboardEvent) => {
		if (!READING_KEYS.has(e.key)) releaseFirstPaint('key');
	};
	const timer = setTimeout(() => releaseFirstPaint('timeout'), WAIT_MS);
	// The reader has its text: the paint goes once the text stands where the paint's does.
	let settle = 0;
	ready = () => {
		ready = null;
		const until = performance.now() + HEAD_MS;
		const body = frame.querySelector<HTMLElement>('.reader-body');
		const check = () => {
			const app = own('.col--reader .reader-body');
			const there = !body || !app || Math.abs(depth(app) - depth(body)) < 1;
			if (there) releaseFirstPaint('text');
			else if (performance.now() > until) releaseFirstPaint('head');
			else settle = requestAnimationFrame(check);
		};
		check();
	};
	doc.addEventListener('pointerdown', outside, true);
	doc.addEventListener('keydown', key, true);
	done = (reason: string) => {
		// Why it went, for the browser suite and for whoever looks: `text` as it should.
		doc.documentElement.dataset.takeover = reason;
		cancelAnimationFrame(raf);
		cancelAnimationFrame(settle);
		clearTimeout(timer);
		ready = null;
		doc.removeEventListener('pointerdown', outside, true);
		doc.removeEventListener('keydown', key, true);
		// Where the reader read to in the paint, the app's reader starts.
		// The reader scrolls in its column, on a narrow screen in the reading view.
		for (const scroller of ['.reader-frame', '.explore-read']) {
			const from = frame.querySelector(scroller);
			const to = own(scroller);
			if (from && to && from.scrollTop > 0) to.scrollTop = from.scrollTop;
		}
		frame.remove();
	};
}

/** The app's reader has its text (ReaderFrame): the paint goes once it stands in its place. */
export function readerReady() {
	ready?.();
}

/** The paint is no longer the page: it goes (`reason`: the step to another address, else
 *  what made it go). */
export function releaseFirstPaint(reason = 'step') {
	const go = done;
	done = null;
	go?.(reason);
}
