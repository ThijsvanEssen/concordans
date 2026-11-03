// One name per soort: the names of the Verbonden groups are read from BRON_LABEL, not written twice.
import { describe, expect, it } from 'vitest';
import { SORT_NAMES } from '$lib/verbonden/summary';
import { BRON_LABEL, type Collection } from '$lib/vocabulary';
import { lowerFirst } from '$lib/text/words';

const OF: Record<string, Collection> = {
	judgments: 'judgments',
	documents: 'documents',
	dossiers: 'dossiers',
	decisions: 'decisions',
	activities: 'activities',
	commitments: 'commitments',
	cases: 'cases',
	factions: 'factions',
	committees: 'committees',
	cabinets: 'cabinets'
};

describe('the names of the soorten', () => {
	it.each(Object.entries(OF))('names %s as BRON_LABEL does', (id, collection) => {
		const [one, many] = BRON_LABEL[collection];
		const soort = SORT_NAMES[id as keyof typeof SORT_NAMES];
		expect(soort.label).toBe(many);
		expect(lowerFirst(soort.many)).toBe(lowerFirst(many));
		expect(lowerFirst(soort.one)).toBe(lowerFirst(one));
	});

	it('names the persons by their role: Kamerleden in Parlement, bewindspersonen in Regering', () => {
		expect(SORT_NAMES.members.label).toBe('Kamerleden');
		expect(SORT_NAMES.ministers.label).toBe('Bewindspersonen');
	});

	it('differs only for the laws, a soort of wetten and artikelen', () => {
		expect(SORT_NAMES.laws.label).toBe('Wetten');
	});
});
