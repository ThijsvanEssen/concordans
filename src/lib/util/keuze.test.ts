import { describe, expect, it } from 'vitest';
import openapi from '$lib/api/openapi.json';
import { MINISTRY_KEYS, facetOpties, keuzeUit } from './keuze';

describe('a choice filter from the URL', () => {
	it('keeps a known value and ignores an unknown one', () => {
		expect(keuzeUit('open', ['open', 'closed'] as const)).toBe('open');
		expect(keuzeUit('Open', ['open', 'closed'] as const)).toBeUndefined();
		expect(keuzeUit(null, ['open'] as const)).toBeUndefined();
		expect(keuzeUit('fin', MINISTRY_KEYS)).toBe('fin');
		expect(keuzeUit('financien', MINISTRY_KEYS)).toBeUndefined();
	});

	it('knows the ministries the schema knows', () => {
		expect([...MINISTRY_KEYS].sort()).toEqual(
			[...openapi.components.schemas.MinistryKey.enum].sort()
		);
	});
});

describe('the options of a facet', () => {
	const counts = new Map([
		['Motie', 12],
		['Amendement', 0],
		['null', 3]
	]);

	it('lists what is counted, without the empty and without none', () => {
		expect(facetOpties(counts, null)).toEqual([['Motie', 12]]);
	});

	it('keeps the chosen value in sight, also at 0 or unknown to the API', () => {
		expect(facetOpties(counts, 'Amendement')).toEqual([
			['Motie', 12],
			['Amendement', 0]
		]);
		expect(facetOpties(counts, 'motie')).toEqual([
			['Motie', 12],
			['motie', 0]
		]);
	});
});
