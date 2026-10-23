import { describe, expect, it } from 'vitest';
import {
	choiceRank,
	forAgainst,
	hasVotes,
	stemmingNaam,
	votesSentence,
	votesShort
} from '$lib/votes/stemming';

describe('stemmingNaam', () => {
	it('names a stemming by its subject', () => {
		expect(stemmingNaam('Motie van het lid De Beer', '36799')).toBe('Motie van het lid De Beer');
	});

	it('falls back to the dossier, then to the plain fact, never to a sign', () => {
		expect(stemmingNaam(null, '36799')).toBe('Stemming over Dossier 36799');
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

describe('the tally as words', () => {
	it('counts only numbers, and reads a tally from the props of a node', () => {
		expect(forAgainst({ Voor: '3', Tegen: 2 } as unknown)).toEqual({ voor: 0, tegen: 2 });
		expect(forAgainst('geen')).toEqual({ voor: 0, tegen: 0 });
	});

	it('has votes where any seat is for or against', () => {
		expect(hasVotes({ Voor: 141, Tegen: 7 })).toBe(true);
		expect(hasVotes({ Voor: 150 })).toBe(true);
		expect(hasVotes({ Voor: 0, Tegen: 0 })).toBe(false);
		expect(hasVotes(undefined)).toBe(false);
	});

	it('says the tally in a sentence, `141 voor, 7 tegen`, or with `en`', () => {
		expect(votesSentence({ Voor: 141, Tegen: 7 })).toBe('141 voor, 7 tegen');
		expect(votesSentence({ Voor: 137, Tegen: 13 }, ' en ')).toBe('137 voor en 13 tegen');
		expect(votesSentence({ Voor: 150 })).toBe('150 voor, 0 tegen');
		expect(votesSentence({})).toBeNull();
	});

	it('says the tally short, `139–11`', () => {
		expect(votesShort({ Voor: 139, Tegen: 11 })).toBe('139–11');
		expect(votesShort({ Voor: 0, Tegen: 0 })).toBeNull();
		expect(votesShort(null)).toBeNull();
	});
});
