import { describe, expect, it } from 'vitest';
import { COALITION_VOTES as CASES, faction } from '$lib/fixtures/coalition-votes';
import { coalitionFactionsOf, coalitionLine } from './coalitie';

const FRACTIES = [
	faction('d66', 'Voor', 26),
	faction('vvd', 'Tegen', 22),
	faction('cda', 'Tegen', 18)
];

describe('the coalition line of a vote', () => {
	it('gives the side of a coalition as one', () => {
		expect(coalitionLine(CASES.tegen, [])).toMatchObject({
			together: { choice: 'Tegen', outcome: 'nee' },
			sides: []
		});
		expect(coalitionLine(CASES.voor, [])?.together?.choice).toBe('Voor');
	});

	it('says nothing where the coalition cast no seat', () => {
		expect(coalitionLine(CASES.geen, [])).toBeNull();
	});

	it('names the coalition fracties per side where it split, one that split itself apart', () => {
		const r = coalitionLine(CASES.verdeeld, [...FRACTIES, faction('pvv', null, 0)])!;
		expect(r.together).toBeNull();
		expect(r.sides.map((s) => [s.choice, s.names])).toEqual([
			['Voor', ['D66']],
			['Tegen', ['VVD', 'CDA']]
		]);
		expect(r.splitFactions).toEqual(['PVV']);
		expect(r.labels).toEqual([]);
	});

	it('gives the seats per side where the fracties are not known', () => {
		const r = coalitionLine(CASES.verdeeld, [])!;
		expect(r.sides.map((s) => [s.choice, s.names, s.seats])).toEqual([
			['Voor', [], 26],
			['Tegen', [], 40]
		]);
	});

	it('names a wisselmeerderheid and a decisive coalition', () => {
		expect(coalitionLine(CASES.wissel, FRACTIES)?.labels).toEqual([
			'wisselmeerderheid',
			'doorslaggevend'
		]);
	});
});

describe('the coalition fracties of a decision', () => {
	it('takes the fracties that voted and are of the coalition that day', () => {
		const voters = [
			{ id: 'factions/d66', name: 'D66', choice: 'Voor', seats: 26 },
			{ id: 'factions/pro', name: 'PRO', choice: 'Voor', seats: 20 },
			{ id: 'factions/vvd', name: 'VVD', choice: 'Tegen', seats: 22 },
			{ id: 'members/x', name: 'X', choice: 'Voor', seats: null }
		];
		const coalitie = new Map([
			['d66', true],
			['pro', false],
			['vvd', true]
		]);
		expect(coalitionFactionsOf(voters, coalitie)).toEqual([
			{ key: 'd66', short: 'D66', choice: 'Voor', seats_for: 26, seats_against: 0 },
			{ key: 'vvd', short: 'VVD', choice: 'Tegen', seats_for: 0, seats_against: 22 }
		]);
		expect(coalitionFactionsOf(voters, null)).toEqual([]);
	});
});
