import { describe, expect, it } from 'vitest';
import { stemmingNaam } from './stemming';

describe('stemmingNaam', () => {
	it('names a stemming by its subject', () => {
		expect(stemmingNaam('Motie van het lid De Beer', '36799')).toBe('Motie van het lid De Beer');
	});

	it('falls back to the dossier, then to the plain fact, never to a sign', () => {
		expect(stemmingNaam(null, '36799')).toBe('Stemming over Kamerstuk 36799');
		expect(stemmingNaam('  ', null)).toBe('Stemming, onderwerp niet in de gegevens');
	});
});
