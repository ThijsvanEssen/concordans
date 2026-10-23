// One name per soort: the names of the Verbonden groups are read from BRON_LABEL, not written twice.
import { describe, expect, it } from 'vitest';
import { SOORT_LABEL } from '$lib/verbonden/summary';
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
	members: 'members',
	factions: 'factions',
	committees: 'committees',
	cabinets: 'cabinets'
};

describe('the names of the soorten', () => {
	it.each(Object.entries(OF))('names %s as BRON_LABEL does', (id, collection) => {
		const [one, many] = BRON_LABEL[collection];
		const soort = SOORT_LABEL[id as keyof typeof SOORT_LABEL];
		expect(soort.label).toBe(many);
		expect(lowerFirst(soort.many)).toBe(lowerFirst(many));
		expect(lowerFirst(soort.one)).toBe(lowerFirst(one));
	});

	it('differs only for the laws, a soort of wetten and artikelen', () => {
		expect(SOORT_LABEL.laws.label).toBe('Wetten');
	});
});
