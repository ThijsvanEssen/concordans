// A box that pans sideways in itself (`data-zijscroll`), not the page: its edges say where
// more stands. `use:sideScroll` sets `data-more-left` and `data-more-right` while the box hides
// something on that side; its style fades that edge (basis.css). `focus`: a box of text
// alone, with nothing to tab to, takes the keyboard while it pans (a wide table).

/** Which sides of `el` hide something. */
export function hiddenSides(el: Pick<HTMLElement, 'scrollLeft' | 'scrollWidth' | 'clientWidth'>) {
	const { scrollLeft, scrollWidth, clientWidth } = el;
	return { left: scrollLeft > 1, right: scrollLeft + clientWidth < scrollWidth - 1 };
}

/** Pans `el` so that `child` stands in the middle of it, as far as it goes. */
export function centerChild(el: HTMLElement, child: HTMLElement) {
	const target = child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2;
	el.scrollTo({
		left: Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth)),
		behavior: 'instant'
	});
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
	// What takes the keyboard comes clear of the faded edge (its `scroll-padding-inline`), not
	// half under it: the browser only pans it into view.
	const clear = (e: FocusEvent) => {
		const t = e.target as HTMLElement | null;
		const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
		if (!t || !pad || t === el) return;
		const left = t.getBoundingClientRect().left - el.getBoundingClientRect().left;
		const right = el.clientWidth - (left + t.offsetWidth);
		if (left < pad) el.scrollBy({ left: left - pad, behavior: 'instant' });
		else if (right < pad) el.scrollBy({ left: pad - right, behavior: 'instant' });
	};
	el.addEventListener('focusin', clear);
	return {
		update: (next: { focus?: boolean } = {}) => {
			focus = next.focus ?? false;
			measure();
		},
		destroy: () => {
			observer.disconnect();
			el.removeEventListener('scroll', measure);
			el.removeEventListener('focusin', clear);
		}
	};
}
