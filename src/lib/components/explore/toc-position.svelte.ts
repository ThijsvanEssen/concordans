// Where the reader is in a text with sections (a stuk, a uitspraak): the section at the top
// of what scrolls. The table of contents beside it (DocumentToc, JudgmentToc, in the column
// or the sheet Inhoud) marks it, as LezenNav marks the article at the top of a law.
import { scrollerOf } from '$lib/bron/landing';

/** The line a section crosses to be the one at the top: a little under the top of what scrolls. */
const POSITION_LINE = 80;

/**
 * The section at the top: the last one that starts at or above `line` (px from the top of
 * the viewport, as the sections' own tops); none while the text still stands above the first.
 */
export function sectionAtTop(sections: readonly { id: string; top: number }[], line: number) {
	let at: string | null = null;
	for (const s of sections) if (s.top <= line) at = s.id;
	return at;
}

/**
 * Follows the section at the top of the text into `current`: once a frame while the text
 * scrolls, at once, and again when the sections come into the page. Call it while a
 * component is set up.
 */
export function followSections(ids: () => string[]) {
	let current = $state<string | null>(null);
	$effect(() => {
		const list = ids();
		if (list.length === 0) {
			current = null;
			return;
		}
		let frame = 0;
		let pending = false;
		const measure = () => {
			pending = false;
			const els = list
				.map((id) => document.getElementById(id))
				.filter((el): el is HTMLElement => !!el);
			if (els.length === 0) {
				current = null;
				return;
			}
			const scroller = scrollerOf(els[0]);
			const top = scroller?.getBoundingClientRect().top ?? 0;
			current = sectionAtTop(
				els.map((el) => ({ id: el.id, top: el.getBoundingClientRect().top })),
				top + POSITION_LINE
			);
		};
		const schedule = () => {
			if (pending) return;
			pending = true;
			frame = requestAnimationFrame(measure);
		};
		addEventListener('scroll', schedule, { capture: true, passive: true });
		schedule();
		// The text comes in after the contents (the reader loads its own copy): look again.
		const later = setTimeout(schedule, 600);
		return () => {
			removeEventListener('scroll', schedule, { capture: true });
			clearTimeout(later);
			if (pending) cancelAnimationFrame(frame);
		};
	});
	return {
		get current() {
			return current;
		}
	};
}
