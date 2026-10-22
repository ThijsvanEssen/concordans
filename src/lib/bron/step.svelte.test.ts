import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/client';

const goto = vi.fn(() => Promise.resolve());
vi.mock('$app/navigation', () => ({ goto }));
const { Steps } = await import('./step.svelte');

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('a step to the next article', () => {
	it('moves the address only once its text is in', async () => {
		const steps = new Steps();
		let done: (v: unknown) => void = () => {};
		steps.follow({ href: '/a/2', name: 'Artikel 2', load: () => new Promise((r) => (done = r)) });
		expect(steps.pending).toBe('/a/2');
		expect(goto).not.toHaveBeenCalled();
		done(null);
		await settle();
		expect(goto).toHaveBeenCalledWith('/a/2', { noScroll: true });
		expect(steps.pending).toBeNull();
	});

	it('stays where it is when the text fails, and says which, with a way to ask again', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		goto.mockClear();
		const steps = new Steps();
		const load = vi.fn(() => Promise.reject(new ApiError(500, '/api/x')));
		steps.follow({ href: '/a/3', name: 'Artikel 3', load });
		await settle();
		expect(goto).not.toHaveBeenCalled();
		expect(steps.failure?.what).toBe('Artikel 3');
		steps.failure?.retry();
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('leaves a click for a new tab to the browser', () => {
		const steps = new Steps();
		const load = vi.fn(() => Promise.resolve());
		const e = { defaultPrevented: false, button: 0, metaKey: true, preventDefault: vi.fn() };
		steps.follow({ href: '/a/4', name: 'Artikel 4', load }, e as unknown as MouseEvent);
		expect(load).not.toHaveBeenCalled();
		expect(e.preventDefault).not.toHaveBeenCalled();
	});
});
