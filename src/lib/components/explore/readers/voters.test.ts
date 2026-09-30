import { describe, expect, it } from 'vitest';
import { UNNAMED } from '$lib/verbonden/rows';
import { ekFactionGroups, votersOf } from './voters';

describe('ekFactionGroups', () => {
	it('lists the fracties for, against and noted, leaving out an empty side', () => {
		expect(
			ekFactionGroups({
				factions_for: ['CDA', 'VVD'],
				factions_against: ['BBB', 'FVD'],
				factions_noted: []
			})
		).toEqual([
			{ label: 'Voor', names: ['CDA', 'VVD'] },
			{ label: 'Tegen', names: ['BBB', 'FVD'] }
		]);
		expect(ekFactionGroups({ factions_noted: ['SGP', 'FVD', 'JA21'] })).toEqual([
			{ label: 'Aantekening', names: ['SGP', 'FVD', 'JA21'] }
		]);
	});
});

const vote = (name: string, choice: string, seats: number) => ({
	voter_id: `members/${name || 'x'}`,
	voter_key: name || 'x',
	name,
	choice,
	seats
});

describe('votersOf', () => {
	it('lists a hoofdelijke stemming by choice and name, one vote per member', () => {
		const voters = votersOf({
			vote_kind: 'member',
			votes: [
				vote('Wieke Paulusma', 'Tegen', 26),
				vote('', 'Tegen', 22),
				vote('Geert Wilders', 'Voor', 20)
			]
		});
		expect(voters.map((v) => [v.choice, v.name, v.seats])).toEqual([
			['Voor', 'Geert Wilders', null],
			['Tegen', 'Wieke Paulusma', null],
			['Tegen', UNNAMED, null]
		]);
	});

	it('lists fracties by the seats they cast', () => {
		const voters = votersOf({
			vote_kind: 'faction',
			votes: [vote('VVD', 'Voor', 22), vote('D66', 'Voor', 26)]
		});
		expect(voters.map((v) => [v.name, v.seats])).toEqual([
			['D66', 26],
			['VVD', 22]
		]);
	});
});
