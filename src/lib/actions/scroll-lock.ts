// The page behind a modal sheet or dialog stands still while it is open: the body is fixed at
// the scroll position it had, and put back there when the last one closes. With
// `overscroll-behavior: contain` on the sheet itself, a scroll that reaches its end does not
// carry on to the page. One lock may stand under another (a filter pane with its Periode).

let holders = 0;
let kept = { y: 0, position: '', top: '', width: '' };

export function lockScroll(): () => void {
	if (typeof document === 'undefined') return () => {};
	const body = document.body;
	if (holders++ === 0) {
		kept = {
			y: window.scrollY,
			position: body.style.position,
			top: body.style.top,
			width: body.style.width
		};
		body.style.position = 'fixed';
		body.style.top = `${-kept.y}px`;
		body.style.width = '100%';
	}
	let released = false;
	return () => {
		if (released) return;
		released = true;
		if (--holders > 0) return;
		body.style.position = kept.position;
		body.style.top = kept.top;
		body.style.width = kept.width;
		const y = kept.y;
		const back = () => window.scrollTo({ top: y, behavior: 'instant' });
		back();
		// The page may not have its height again yet: once more where it still stands short.
		requestAnimationFrame(() => {
			if (Math.abs(window.scrollY - y) > 1) back();
		});
	};
}
