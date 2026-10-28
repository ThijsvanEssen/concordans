import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { seatsOf, sittingOf, standingWord } from './committee';

const lid = (name: string, family_name: string, role: string | null) =>
	({ key: name, name, family_name, role }) as Schema<'MemberDTO'>;

describe('the standing of a committee', () => {
	it('reads `sitting` where the API gives it, and nothing where it does not yet', () => {
		expect(sittingOf({ sitting: true })).toBe(true);
		expect(sittingOf({ sitting: false })).toBe(false);
		// Before API 0.80.15 (production until its release): no label.
		expect(sittingOf({})).toBeNull();
		expect(sittingOf(null)).toBeNull();
		expect(standingWord(true)).toBe('Actief');
		expect(standingWord(false)).toBe('Opgeheven');
		expect(standingWord(null)).toBeNull();
	});
});

describe('the seats of a committee', () => {
	it('puts the officers first and the substitutes apart, each by family name', () => {
		const seats = seatsOf([
			lid('Iem Al Biyati', 'Biyati', 'Lid'),
			lid('Etkin Armut', 'Armut', 'PlvLid'),
			lid('Marieke Vellinga', 'Vellinga', 'OnderVz'),
			lid('Mirjam Bikker', 'Bikker', 'Lid'),
			lid('Bente Becker', 'Becker', 'Plv. lid'),
			lid('Mohammed Mohandis', 'Mohandis', 'Voorzitter'),
			lid('Toine Beukering', 'Beukering', null)
		]);
		expect(seats.officers.map((m) => [m.zetel, m.name])).toEqual([
			['voorzitter', 'Mohammed Mohandis'],
			['ondervoorzitter', 'Marieke Vellinga']
		]);
		expect(seats.leden.map((m) => m.name)).toEqual([
			'Toine Beukering',
			'Mirjam Bikker',
			'Iem Al Biyati'
		]);
		expect(seats.plaatsvervangers.map((m) => m.name)).toEqual(['Etkin Armut', 'Bente Becker']);
	});
});
