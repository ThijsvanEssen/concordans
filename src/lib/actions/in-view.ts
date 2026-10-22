// A part asked for only when it is about to be seen (the footer's stand, a bill's timetable):
// `use:inView={() => (seen = true)}`. Once, a little before it scrolls into view.

/** How far before the viewport a part starts: it is there when it is scrolled to. */
export const IN_VIEW_MARGIN = '200px';

export function inView(el: HTMLElement, onSeen: () => void) {
	let seen = onSeen;
	// A browser without the observer shows the part at once.
	if (typeof IntersectionObserver === 'undefined') {
		onSeen();
		return { update: () => {}, destroy: () => {} };
	}
	const observer = new IntersectionObserver(
		([entry]) => {
			if (!entry.isIntersecting) return;
			observer.disconnect();
			seen();
		},
		{ rootMargin: IN_VIEW_MARGIN }
	);
	observer.observe(el);
	return {
		update: (next: () => void) => (seen = next),
		destroy: () => observer.disconnect()
	};
}
