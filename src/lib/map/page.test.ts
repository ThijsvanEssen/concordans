import { describe, expect, it } from 'vitest';
import { BUNDLES_PATH, bundlePageHref, movedBundleAddress } from './page';

const moved = (href: string) => movedBundleAddress(new URL(href, 'https://concordans.nl'));

describe('the addresses of the bundels (decision 19)', () => {
	it('gives the overview and a bundel’s own page under /bundels', () => {
		expect(BUNDLES_PATH).toBe('/bundels');
		expect(bundlePageHref({ id: 'k3j2h1g0' })).toBe('/bundels/k3j2h1g0');
	});

	it('moves the old overview to /bundels, its shared link with it', () => {
		expect(moved('/gemarkeerd')).toBe('/bundels');
		expect(moved('/gemarkeerd/')).toBe('/bundels');
		expect(moved('/gemarkeerd#m=abc')).toBe('/bundels#m=abc');
		// A link of the older form keeps its query: the overview says it is broken.
		expect(moved('/gemarkeerd?map=x#m=abc')).toBe('/bundels?map=x#m=abc');
	});

	it('moves an old bundel page to its own address, by the id of its query', () => {
		expect(moved('/gemarkeerd/bundel?id=k3j2h1g0')).toBe('/bundels/k3j2h1g0');
		expect(moved('/gemarkeerd/bundel')).toBe('/bundels');
	});

	it('leaves every other address alone', () => {
		expect(moved('/bundels')).toBeNull();
		expect(moved('/bundels/k3j2h1g0')).toBeNull();
		expect(moved('/gemarkeerde')).toBeNull();
		expect(moved('/wetten/BWBR0005289/artikel/6:162')).toBeNull();
	});
});
