// The place marked in a navigation column stays in view in it: scrolled within the column,
// not the page (LezenNav keeps its own marks the same way).

/** Scrolls `nav` so that its marked row (`.is-active`) stands in the middle third, once a frame has passed. */
export function keepMarkedInView(nav: HTMLElement | null) {
	if (!nav) return;
	requestAnimationFrame(() => {
		const active = nav.querySelector<HTMLElement>('.is-active');
		if (!active) return;
		const box = nav.getBoundingClientRect();
		const at = active.getBoundingClientRect();
		if (at.top < box.top + box.height / 4 || at.bottom > box.bottom - box.height / 4)
			nav.scrollTop += at.top - box.top - box.height / 3;
	});
}
