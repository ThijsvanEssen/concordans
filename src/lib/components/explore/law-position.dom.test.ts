// The table of contents marks where the reader is (K3): read when the text scrolls, and also at
// once after a jump or a new list, where nothing scrolls (B4).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { followPosition, lawPosition } from './law-position.svelte';

/** A whole law with its articles at `tops` (px from the top of the viewport), 100 px each. */
function law(tops: Record<string, number>) {
	const el = document.createElement('article');
	for (const [number, top] of Object.entries(tops)) {
		const a = document.createElement('section');
		a.className = 'whole-article';
		a.dataset.artikel = number;
		a.getBoundingClientRect = () => ({ top, bottom: top + 100 }) as DOMRect;
		el.append(a);
	}
	document.body.append(el);
	return el;
}

describe('followPosition', () => {
	afterEach(() => {
		lawPosition.clear();
		document.body.innerHTML = '';
		vi.unstubAllGlobals();
	});
	it('marks the article at the top at once, without a scroll', () => {
		vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => (f(0), 1));
		const follow = followPosition(law({ '3:10': 0, '3:11': 100 }), 'BWBR0005537');
		expect(lawPosition.of('BWBR0005537')).toBe('3:10');
		follow.stop();
	});

	it('reads again after a jump', () => {
		vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => (f(0), 1));
		const el = law({ '3:10': 0, '3:11': 100 });
		const follow = followPosition(el, 'BWBR0005537');
		for (const a of el.querySelectorAll<HTMLElement>('.whole-article'))
			a.getBoundingClientRect = () =>
				({
					top: a.dataset.artikel === '3:11' ? 0 : -100,
					bottom: a.dataset.artikel === '3:11' ? 100 : 0
				}) as DOMRect;
		follow.read();
		expect(lawPosition.of('BWBR0005537')).toBe('3:11');
		follow.stop();
		expect(lawPosition.of('BWBR0005537')).toBeNull();
	});
});
