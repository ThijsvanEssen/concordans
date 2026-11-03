import { PANEL_ID } from '$lib/reading/panel.svelte';

/** The stump just chosen: the keten is drawn anew for its parent, so this outlives the drawing. */
export const landing = $state({ id: '' });

const frame = () => new Promise((done) => requestAnimationFrame(done));

/** Where to scroll so that `x` of the drawing stands in the middle of the view. */
export const centre = (x: number, scale: number, avail: number) =>
	Math.max(0, x * scale - avail / 2);

/**
 * The Zijpaneel lies over the right of the drawing: the label just clicked stays clear of it.
 * `makeRoom` gives the drawing room at its end as wide as the panel, and it pans by what the
 * label was under; where the panel is a sheet (a narrow screen) the page scrolls the label above it.
 */
export async function clearOfZijpaneel(
	label: Element,
	pan: HTMLElement,
	makeRoom: (px: number) => Promise<void>
): Promise<void> {
	// The panel comes with the address: wait for it, a second at most.
	let panel: HTMLElement | null = null;
	for (let i = 0; i < 20 && !panel; i++) {
		await new Promise((done) => setTimeout(done, 50));
		panel = document.getElementById(PANEL_ID);
	}
	if (!panel) return;
	await frame();
	const l = label.getBoundingClientRect();
	const p = panel.getBoundingClientRect();
	const view = pan.getBoundingClientRect();
	const gap = 16;
	if (p.left > view.left + view.width / 4 && p.left < view.right) {
		await makeRoom(view.right - p.left);
		const hidden = l.right + gap - p.left;
		if (hidden > 0) pan.scrollBy({ left: hidden, behavior: 'smooth' });
	} else if (p.top > 0 && p.top < window.innerHeight && l.bottom + gap > p.top) {
		window.scrollBy({ top: l.bottom + gap - p.top, behavior: 'smooth' });
	}
}
