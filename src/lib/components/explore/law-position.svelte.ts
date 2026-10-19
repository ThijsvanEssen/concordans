// Where the reader is in the whole law: the article at the top of the text, as the whole-law
// reader sees it scroll by. The table of contents beside it (LezenNav, in the column or the
// sheet Inhoud) marks it and opens the divisions it stands in.
import { scrollerOf } from '$lib/bron/landing';

class LawPosition {
	/** The law read (its id as the reader has it), and the number of the article at the top. */
	law = $state<string | null>(null);
	article = $state<string | null>(null);

	set(law: string, article: string | null) {
		if (this.law === law && this.article === article) return;
		this.law = law;
		this.article = article;
	}

	/** The article at the top in `law`; null for another law, or none yet. */
	of(law: string | null) {
		return law && this.law?.toUpperCase() === law.toUpperCase() ? this.article : null;
	}

	clear() {
		this.law = null;
		this.article = null;
	}
}

export const lawPosition = new LawPosition();

/**
 * The article at the top of a reader: the one that crosses the line (px from the top of the
 * viewport, as the articles' own tops and bottoms); where the line falls between two (on the
 * heading of a division, after a jump to it) the next; after the last, the last.
 */
export function articleAtTop(
	articles: readonly { number: string; top: number; bottom: number }[],
	line: number
): string | null {
	let above: string | null = null;
	for (const a of articles) {
		if (a.top <= line && a.bottom > line) return a.number;
		if (a.top > line) return above === null ? null : a.number;
		above = a.number;
	}
	return above;
}

/** The line the article at the top crosses: a little under the top of what scrolls. */
const POSITION_LINE = 80;

/**
 * Follows the article at the top of the whole law `el` of `law` into lawPosition: once a frame
 * while the text scrolls, at once now, and again on `read` (after a jump or a new list, where
 * nothing scrolls). `stop` ends it and clears the position.
 */
export function followPosition(el: HTMLElement, law: string) {
	let frame = 0;
	let pending = false;
	const measure = (scroller: Element | null) => {
		pending = false;
		const top = scroller instanceof HTMLElement ? scroller.getBoundingClientRect().top : 0;
		const articles = [...el.querySelectorAll<HTMLElement>('.whole-article[data-artikel]')].map(
			(a) => {
				const r = a.getBoundingClientRect();
				return { number: a.getAttribute('data-artikel')!, top: r.top, bottom: r.bottom };
			}
		);
		lawPosition.set(law, articleAtTop(articles, top + POSITION_LINE));
	};
	const schedule = (scroller: Element | null) => {
		if (pending) return;
		pending = true;
		frame = requestAnimationFrame(() => measure(scroller));
	};
	const onScroll = (e: Event) => {
		const scroller = e.target instanceof Element ? e.target : null;
		if (scroller && !scroller.contains(el)) return;
		schedule(scroller);
	};
	addEventListener('scroll', onScroll, { capture: true, passive: true });
	const read = () => schedule(scrollerOf(el));
	read();
	return {
		read,
		stop() {
			removeEventListener('scroll', onScroll, { capture: true });
			if (pending) cancelAnimationFrame(frame);
			lawPosition.clear();
		}
	};
}
