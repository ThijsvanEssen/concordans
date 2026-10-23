// The margin the numbers of a text stand in (PlaceNumber), as wide as its widest number: set by
// the reader's text and by the first paint of a judgment alike, so the text starts where it will
// stay.

/** The step of the spacing scale: a margin grows by it. */
const STEP = 4;

/**
 * Sets `--plaats-num` on `node`: the width of the letters of its widest `.plaats-nummer`, not of
 * the box it may be stretched to, rounded up to the 4 px scale; none without numbers.
 */
export function measurePlaces(node: HTMLElement) {
	const range = document.createRange();
	if (typeof range.getBoundingClientRect !== 'function') return;
	const width = (n: HTMLElement) => {
		range.selectNodeContents(n);
		return range.getBoundingClientRect().width;
	};
	const widest = Math.max(
		0,
		...[...node.querySelectorAll<HTMLElement>('.plaats-nummer')].map(width)
	);
	if (widest > 0) node.style.setProperty('--plaats-num', `${Math.ceil(widest / STEP) * STEP}px`);
	else node.style.removeProperty('--plaats-num');
}
