import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { decidingVote, hasSides, outcomeTone, sidesOf, voteLineOf } from '$lib/votes/vote-line';

type Decision = Schema<'DecisionDTO'>;
const decision = (d: Partial<Decision>): Decision => ({ key: 'k', ...d }) as Decision;
const stem = (name: string, choice: string, seats = 1) => ({
	voter_id: `factions/${name.toLowerCase()}`,
	voter_key: name.toLowerCase(),
	name,
	choice,
	seats,
	path: null
});

describe('outcomeTone', () => {
	it('is one reading for the motie, the stemming and the list: ja, nee, else open', () => {
		expect(outcomeTone(decision({ passed: true }))).toBe('ja');
		expect(outcomeTone(decision({ passed: false }))).toBe('nee');
		expect(outcomeTone(decision({}))).toBe('open');
	});
});

describe('voteLineOf', () => {
	it('says a vote of the Tweede Kamer: its outcome, seats, day and fracties per side', () => {
		const u = voteLineOf(
			decision({
				key: 'decision_1',
				date: '2026-09-29',
				passed: true,
				chamber: 'TK',
				vote_kind: 'faction',
				tally: { Voor: 120, Tegen: 30 },
				votes: [stem('D66', 'Voor', 26), stem('PRO', 'Tegen', 20), stem('VVD', 'Voor', 22)]
			})
		);
		expect(u).toEqual({
			method: null,
			word: 'Aangenomen',
			tone: 'ja',
			how: '120 voor, 30 tegen',
			date: '2026-09-29',
			decision: 'decision_1',
			sides: [
				{ choice: 'Voor', names: ['D66', 'VVD'], seats: [26, 22] },
				{ choice: 'Tegen', names: ['PRO'], seats: [20] }
			]
		});
	});

	it('marks verworpen as nee, and counts every choice of the tally, voor first', () => {
		const u = voteLineOf(
			decision({
				passed: false,
				tally: { 'Niet deelgenomen': 1, Tegen: 130, Voor: 19 },
				votes: []
			})
		);
		expect(u.tone).toBe('nee');
		expect(u.word).toBe('Verworpen');
		expect(u.how).toBe('19 voor, 130 tegen, 1 niet deelgenomen');
		// The Stembalk counts voor and tegen; the line keeps only what it does not.
		expect(u.method).toBe('1 niet deelgenomen');
	});

	it('names no members on a roll-call, only its tally', () => {
		const u = voteLineOf(
			decision({
				passed: true,
				vote_kind: 'member',
				tally: { Voor: 76, Tegen: 74 },
				votes: [stem('Jansen', 'Voor')]
			})
		);
		expect(u.how).toBe('76 voor, 74 tegen, bij hoofdelijke stemming');
		expect(u.method).toBe('bij hoofdelijke stemming');
		expect(u.sides).toEqual([]);
	});

	it('gives the Eerste Kamer its way of deciding and its own lists', () => {
		const u = voteLineOf(
			decision({
				chamber: 'EK',
				passed: true,
				method: 'Stemming bij zitten en opstaan, aangenomen',
				factions_for: ['VVD', 'CDA'],
				factions_against: ['PVV'],
				factions_noted: []
			})
		);
		expect(u.how).toBe('bij zitten en opstaan');
		expect(u.sides).toEqual([
			{ choice: 'Voor', names: ['VVD', 'CDA'], seats: [null, null] },
			{ choice: 'Tegen', names: ['PVV'], seats: [null] }
		]);
	});

	it("says a hamerstuk once, and a postponement in the Kamer's own word", () => {
		const hammer = voteLineOf(decision({ decision_kind: 'Stemmen - zonder stemming aannemen' }));
		expect([hammer.word, hammer.how]).toEqual(['Aangenomen zonder stemming', null]);
		const postponed = voteLineOf(decision({ decision_kind: 'Stemmen - uitstellen' }));
		expect([postponed.word, postponed.tone]).toEqual(['Uitstellen', 'open']);
	});
});

describe('hasSides', () => {
	it('asks a vote by fracties whose votes were not given', () => {
		expect(hasSides(decision({ tally: { Voor: 1, Tegen: 2 }, votes: [] }))).toBe(false);
		expect(hasSides(decision({ tally: { Voor: 1 }, votes: [stem('SP', 'Voor')] }))).toBe(true);
		expect(hasSides(decision({ tally: {}, votes: [] }))).toBe(true);
		expect(hasSides(decision({ chamber: 'EK', tally: { Voor: 1 } }))).toBe(true);
	});
});

describe('sidesOf', () => {
	it('falls back to the voter key for a fractie without a name', () => {
		expect(sidesOf(decision({ votes: [{ ...stem('X', 'Voor'), name: null }] }))).toEqual([
			{ choice: 'Voor', names: ['x'], seats: [1] }
		]);
	});
});

describe('decidingVote', () => {
	const postponed = decision({ key: 'a', decision_kind: 'Stemmen - uitstellen' });
	const passed = decision({ key: 'b', passed: true });
	it('takes the decision the stuk names, else the last with an outcome', () => {
		expect(decidingVote([postponed, passed], 'a')?.key).toBe('a');
		expect(decidingVote([postponed, passed], null)?.key).toBe('b');
		expect(decidingVote([passed, postponed], 'z')?.key).toBe('b');
	});
	it('has none for a stuk only postponed', () => {
		expect(decidingVote([postponed], null)).toBeNull();
		expect(decidingVote(undefined, null)).toBeNull();
	});
});
