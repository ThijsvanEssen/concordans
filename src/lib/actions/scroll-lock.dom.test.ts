import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockScroll } from './scroll-lock';

describe('lockScroll', () => {
	afterEach(() => {
		document.body.removeAttribute('style');
	});

	it('fixes the body at the scroll position and puts the page back', () => {
		const to = vi.fn();
		vi.stubGlobal('scrollTo', to);
		vi.stubGlobal('scrollY', 500);
		const release = lockScroll();
		expect(document.body.style.position).toBe('fixed');
		expect(document.body.style.top).toBe('-500px');
		release();
		expect(document.body.style.position).toBe('');
		expect(to).toHaveBeenCalledWith({ top: 500, behavior: 'instant' });
		vi.unstubAllGlobals();
	});

	it('stays locked until the last holder lets go', () => {
		vi.stubGlobal('scrollTo', vi.fn());
		const a = lockScroll();
		const b = lockScroll();
		a();
		a();
		expect(document.body.style.position).toBe('fixed');
		b();
		expect(document.body.style.position).toBe('');
		vi.unstubAllGlobals();
	});
});
