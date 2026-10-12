import { describe, expect, it } from 'vitest';
import { bundledInto, repeatsHull, telBundels, type Lijn } from './edge-bundles';

// The Cbw map of 12 Oct: two articles of the Cyberbeveiligingsbesluit referring to two of
// the Cyberbeveiligingswet, each law a hull.
const cbb21 = 'articles/bwbr0052875_21';
const cbb20 = 'articles/bwbr0052875_20';
const cbw21 = 'articles/bwbr0052872_21';
const cbw24 = 'articles/bwbr0052872_24';
const groups = new Map<string, Set<string>>([
	[cbb21, new Set(['cbb'])],
	[cbb20, new Set(['cbb'])],
	[cbw21, new Set(['cbw'])],
	[cbw24, new Set(['cbw'])]
]);
const lijnen: Lijn[] = [
	{ id: 'e1', source: cbb21, target: cbw21 },
	{ id: 'e2', source: cbb20, target: cbw24 },
	{ id: 'e3', source: cbb21, target: cbw24 }
];
const bundels = telBundels(lijnen, groups);
const alle = new Set([cbb21, cbb20, cbw21, cbw24]);

describe('lines between chosen bronnen', () => {
	it('draws every line of a map at rest, also the second from one article into a law', () => {
		const hidden = lijnen.filter((l) => bundledInto(l, bundels, groups, alle));
		expect(hidden).toEqual([]);
	});

	it('never lets a line between two chosen bronnen repeat a hull', () => {
		for (const l of lijnen)
			expect(repeatsHull(l.source, l.target, bundels, groups, alle)).toBe(false);
		expect(repeatsHull(cbb21, cbb20, bundels, groups, alle)).toBe(false);
	});
});

describe('lines in a neighbourhood nobody chose', () => {
	const geen = new Set<string>();

	it('bundles several lines from one bron into one hull to the first of them', () => {
		expect(lijnen.filter((l) => bundledInto(l, bundels, groups, geen)).map((l) => l.id)).toEqual([
			'e3'
		]);
	});

	it('bundles them too when only one end is chosen', () => {
		expect(bundledInto(lijnen[2], bundels, groups, new Set([cbb21]))).toBe(true);
	});

	it('lets a line inside one hull repeat it', () => {
		expect(repeatsHull(cbb21, cbb20, bundels, groups, geen)).toBe(true);
	});
});
