import { describe, expect, it } from 'vitest';
import { choiceRank, forAgainst, stemmingNaam } from './stemming';

describe('stemmingNaam', () => {
	it('names a stemming by its subject', () => {
		expect(stemmingNaam('Motie van het lid De Beer', '36799')).toBe('Motie van het lid De Beer');
	});

	it('falls back to the dossier, then to the plain fact, never to a sign', () => {
		expect(stemmingNaam(null, '36799')).toBe('Stemming over Kamerstuk 36799');
		expect(stemmingNaam('  ', null)).toBe('Stemming, onderwerp niet in de gegevens');
	});
});

describe('choiceRank', () => {
	it('puts Voor first, then Tegen, then any other choice', () => {
		const choices = ['Niet deelgenomen', 'Tegen', 'Voor'];
		expect(choices.sort((a, b) => choiceRank(a) - choiceRank(b))).toEqual([
			'Voor',
			'Tegen',
			'Niet deelgenomen'
		]);
		expect(choiceRank('Niet deelgenomen')).toBe(choiceRank('Onthouding'));
	});
});

describe('forAgainst', () => {
	it('counts the seats for and against, none where the tally has no such choice', () => {
		expect(forAgainst({ Voor: 141, Tegen: 7, 'Niet deelgenomen': 2 })).toEqual({
			voor: 141,
			tegen: 7
		});
		expect(forAgainst({ Voor: 3 })).toEqual({ voor: 3, tegen: 0 });
		expect(forAgainst(null)).toEqual({ voor: 0, tegen: 0 });
	});
});
