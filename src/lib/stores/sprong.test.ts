import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { paneelSprongen, sprongDoel } from './sprong';

/** A media query whose match the test sets, as a window narrowed after loading. */
function scherm(breed: boolean) {
	const luisteraars = new Set<() => void>();
	const mq = {
		matches: breed,
		addEventListener: (_: string, f: () => void) => luisteraars.add(f),
		removeEventListener: (_: string, f: () => void) => luisteraars.delete(f)
	};
	vi.stubGlobal('window', { matchMedia: () => mq });
	return (nu: boolean) => {
		mq.matches = nu;
		luisteraars.forEach((f) => f());
	};
}

afterEach(() => vi.unstubAllGlobals());

describe('a skip link to a pane', () => {
	it('is there only while the pane stands beside the text (UX-toets 10 Oct, #34)', () => {
		const zet = scherm(true);
		const el = {} as HTMLElement;
		const a = sprongDoel(el, {
			id: 'verbonden',
			label: 'Naar Verbonden',
			naast: '(min-width: 769px)'
		});
		expect(get(paneelSprongen).map((s) => s.label)).toEqual(['Naar Verbonden']);
		expect(el.id).toBe('verbonden');
		// Narrowed: the pane is a tab of its own, hidden until chosen.
		zet(false);
		expect(get(paneelSprongen)).toEqual([]);
		zet(true);
		expect(get(paneelSprongen).map((s) => s.label)).toEqual(['Naar Verbonden']);
		a.destroy();
		expect(get(paneelSprongen)).toEqual([]);
	});
});
