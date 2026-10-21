// A box that pans sideways in itself (`data-zijscroll`), not the page: its edges say where
// more stands. `use:sideScroll` sets `data-more-left` and `data-more-right` while the box hides
// something on that side; its style fades that edge (basis.css). `focus`: a box of text
// alone, with nothing to tab to, takes the keyboard while it pans (a wide table).

/** Which sides of `el` hide something. */
export function hiddenSides(el: Pick<HTMLElement, 'scrollLeft' | 'scrollWidth' | 'clientWidth'>) {
	const { scrollLeft, scrollWidth, clientWidth } = el;
	return { left: scrollLeft > 1, right: scrollLeft + clientWidth < scrollWidth - 1 };
}

export function sideScroll(el: HTMLElement, opts: { focus?: boolean } = {}) {
	let focus = opts.focus ?? false;
	const measure = () => {
		const more = hiddenSides(el);
		el.toggleAttribute('data-more-left', more.left);
		el.toggleAttribute('data-more-right', more.right);
		if (!focus) return;
		if (more.left || more.right) el.tabIndex = 0;
		else el.removeAttribute('tabindex');
	};
	measure();
	const observer = new ResizeObserver(measure);
	observer.observe(el);
	// What it holds can widen it too (a text that comes in later).
	if (el.firstElementChild) observer.observe(el.firstElementChild);
	el.addEventListener('scroll', measure, { passive: true });
	return {
		update: (next: { focus?: boolean } = {}) => {
			focus = next.focus ?? false;
			measure();
		},
		destroy: () => {
			observer.disconnect();
			el.removeEventListener('scroll', measure);
		}
	};
}
