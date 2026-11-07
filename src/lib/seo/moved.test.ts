import { describe, expect, it } from 'vitest';
import { movedAddress } from './moved';
import moved from './moved.json';
import { LIST_PATHS, OVERVIEW_PATH } from '$lib/bron/lists';

const at = (path: string) => movedAddress(new URL(path, 'https://concordans.nl'));

describe('movedAddress', () => {
	it('sends a list of Bladeren to its own address, with its filters (B128)', () => {
		expect(at('/explore?mode=index&kind=instruments')).toBe('/wetten');
		expect(at('/explore?kind=decisions&mode=index&q=stikstof#x')).toBe('/stemmingen?q=stikstof#x');
		expect(at('/explore?mode=index&kind=ministers&kabinet=rutte_iv')).toBe(
			'/bewindspersonen?kabinet=rutte_iv'
		);
	});

	it('sends the index without a list to the overview', () => {
		expect(at('/explore?mode=index')).toBe('/bladeren');
		expect(at('/explore/?mode=index&q=huur')).toBe('/bladeren?q=huur');
	});

	it('leaves the network, the lists and any other address alone', () => {
		expect(at('/explore')).toBeNull();
		expect(at('/explore?focus=decisions/d1&mode=netwerk')).toBeNull();
		expect(at('/wetten')).toBeNull();
		expect(at('/wetten/BWBR0005289')).toBeNull();
		expect(at('/zoeken?q=huur')).toBeNull();
	});

	it('lists every list and the overview once, at the address the app serves it on', () => {
		const lists = Object.entries(LIST_PATHS).map(([kind, path]) => [
			`/explore?mode=index&kind=${kind}`,
			path
		]);
		expect(moved).toEqual(Object.fromEntries([...lists, ['/explore?mode=index', OVERVIEW_PATH]]));
	});
});
