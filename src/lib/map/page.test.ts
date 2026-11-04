import { describe, expect, it } from 'vitest';
import { BUNDLES_PATH, bundlePageHref } from './page';

describe('the addresses of the bundels (decision 19)', () => {
	it('gives the overview and a bundel’s own page under /bundels', () => {
		expect(BUNDLES_PATH).toBe('/bundels');
		expect(bundlePageHref({ id: 'k3j2h1g0' })).toBe('/bundels/k3j2h1g0');
	});
});
