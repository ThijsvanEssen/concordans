import { afterEach, describe, expect, it, vi } from 'vitest';
import { followServerMove, isEnactedLawPath } from './moved-law';

describe('a law of the Staatsblad gone from the data', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('is recognised by its address, the law and its articles alike', () => {
		expect(isEnactedLawPath('/wetten/STB-2026-56')).toBe(true);
		expect(isEnactedLawPath('/wetten/STB-2026-56/artikel/2.8.6')).toBe(true);
		expect(isEnactedLawPath('/wetten/BWBR0005289/artikel/6:162')).toBe(false);
	});

	it('asks the server once, which sends it on to the BWB', () => {
		const replace = vi.fn();
		const at = (served: string) => {
			vi.stubGlobal('location', { replace, search: '?lezen=1', hash: '' });
			vi.stubGlobal('performance', {
				getEntriesByType: () => [{ name: `https://concordans.nl${served}` }]
			});
		};
		at('/explore');
		expect(followServerMove('/wetten/STB-2026-56/artikel/2.8.6')).toBe(true);
		expect(replace).toHaveBeenCalledWith('/wetten/STB-2026-56/artikel/2.8.6?lezen=1');
		replace.mockClear();
		// Served for this address: the server had no other one.
		at('/wetten/STB-2026-56/artikel/2.8.6');
		expect(followServerMove('/wetten/STB-2026-56/artikel/2.8.6')).toBe(false);
		at('/explore');
		expect(followServerMove('/wetten/BWBR0005289')).toBe(false);
		expect(replace).not.toHaveBeenCalled();
	});
});
