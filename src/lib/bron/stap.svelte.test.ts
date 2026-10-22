import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/client';

const goto = vi.fn(() => Promise.resolve());
vi.mock('$app/navigation', () => ({ goto }));
const { Stappen } = await import('./stap.svelte');

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('a step to the next article', () => {
	it('moves the address only once its text is in', async () => {
		const stappen = new Stappen();
		let klaar: (v: unknown) => void = () => {};
		stappen.volg({ href: '/a/2', naam: 'Artikel 2', laad: () => new Promise((r) => (klaar = r)) });
		expect(stappen.bezig).toBe('/a/2');
		expect(goto).not.toHaveBeenCalled();
		klaar(null);
		await settle();
		expect(goto).toHaveBeenCalledWith('/a/2', { noScroll: true });
		expect(stappen.bezig).toBeNull();
	});

	it('stays where it is when the text fails, and says which, with a way to ask again', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		goto.mockClear();
		const stappen = new Stappen();
		const laad = vi.fn(() => Promise.reject(new ApiError(500, '/api/x')));
		stappen.volg({ href: '/a/3', naam: 'Artikel 3', laad });
		await settle();
		expect(goto).not.toHaveBeenCalled();
		expect(stappen.fout?.what).toBe('Artikel 3');
		stappen.fout?.retry();
		expect(laad).toHaveBeenCalledTimes(2);
	});

	it('leaves a click for a new tab to the browser', () => {
		const stappen = new Stappen();
		const laad = vi.fn(() => Promise.resolve());
		const e = { defaultPrevented: false, button: 0, metaKey: true, preventDefault: vi.fn() };
		stappen.volg({ href: '/a/4', naam: 'Artikel 4', laad }, e as unknown as MouseEvent);
		expect(laad).not.toHaveBeenCalled();
		expect(e.preventDefault).not.toHaveBeenCalled();
	});
});
