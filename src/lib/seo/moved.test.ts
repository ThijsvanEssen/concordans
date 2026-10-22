import { describe, expect, it } from 'vitest';
import { movedAddress } from './moved';
import moved from './moved.json';
import { isIndexCategory } from '$lib/components/explore/index/categories';
import { parsePad } from '$lib/bron/address';

const at = (path: string) => movedAddress(new URL(path, 'https://concordans.nl'));

describe('movedAddress', () => {
	it('sends a bare collection to its list in Bladeren (B17)', () => {
		expect(at('/wetten')).toBe('/explore?mode=index&kind=instruments');
		expect(at('/uitspraken/')).toBe('/explore?mode=index&kind=judgments');
		expect(at('/stemmingen?q=stikstof')).toBe('/explore?mode=index&kind=decisions&q=stikstof');
	});

	it('leaves /zoeken alone: the page of results (besluit 31)', () => {
		expect(at('/zoeken')).toBeNull();
		expect(at('/zoeken?q=huur')).toBeNull();
	});

	it('leaves a bron and any other address alone; moves the bundels of before', () => {
		expect(at('/wetten/BWBR0005289')).toBeNull();
		expect(at('/actueel')).toBeNull();
		expect(at('/gemarkeerd#m=abc')).toBe('/bundels#m=abc');
	});

	it('lists only paths that are no bron, each to a list the index has', () => {
		for (const [path, target] of Object.entries(moved)) {
			expect(parsePad(path)).toBeNull();
			const to = new URL(target, 'https://x');
			if (to.pathname === '/explore')
				expect(isIndexCategory(to.searchParams.get('kind'))).toBe(true);
		}
	});
});
