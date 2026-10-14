// The footnotes in the margin, where the reader's frame leaves room right of the text
// column: the text gets `noten-in-kantlijn` and the width the notes may take
// (`--kantlijn-w`), and a note that would run into the one above is moved down below it.
// Without the room they stand under their text (Voetnoten.svelte).
import type { Action } from 'svelte/action';

/** The space between the column and a note, and between two notes. */
const AFSTAND = 24;
const TUSSEN = 8;
/** The least and the most a note in the margin takes. */
const SMALST = 180;
const BREEDST = 280;

/** The width the margin leaves a note, or null where it is too narrow. */
export function kantlijnBreedte(ruimte: number): number | null {
	const w = Math.min(BREEDST, ruimte - AFSTAND - TUSSEN);
	return w >= SMALST ? w : null;
}

/** How far each note moves down so none runs into the one above it: tops and heights in order. */
export function schuif(noten: readonly { top: number; height: number }[]): number[] {
	let onder = -Infinity;
	return noten.map((n) => {
		const dy = Math.max(0, onder + TUSSEN - n.top);
		onder = n.top + dy + n.height;
		return dy;
	});
}

export const kantlijn: Action<HTMLElement> = (node) => {
	const frame = node.closest<HTMLElement>('.reader-frame');
	if (!frame) return;
	let bezig = 0;
	const leg = () => {
		cancelAnimationFrame(bezig);
		bezig = requestAnimationFrame(() => {
			const f = frame.getBoundingClientRect();
			const n = node.getBoundingClientRect();
			// The frame's inner right edge: its scrollbar and its own right padding left out.
			const rechts = f.left + frame.clientWidth;
			const w = kantlijnBreedte(rechts - n.right);
			node.classList.toggle('noten-in-kantlijn', w != null);
			if (w != null) node.style.setProperty('--kantlijn-w', `${w}px`);
			const lijsten = [...node.querySelectorAll<HTMLElement>('.voetnoten--marge')];
			for (const l of lijsten) l.style.transform = '';
			if (w == null) return;
			const dy = schuif(
				lijsten.map((l) => {
					const r = l.getBoundingClientRect();
					return { top: r.top, height: r.height };
				})
			);
			lijsten.forEach((l, i) => (l.style.transform = dy[i] ? `translateY(${dy[i]}px)` : ''));
		});
	};
	const ro = new ResizeObserver(leg);
	ro.observe(node);
	ro.observe(frame);
	leg();
	return {
		destroy() {
			cancelAnimationFrame(bezig);
			ro.disconnect();
			node.classList.remove('noten-in-kantlijn');
		}
	};
};
