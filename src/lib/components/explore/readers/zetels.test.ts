import { describe, expect, it } from 'vitest';
import { vacantZonderFractie, wijzigingenVan } from './zetels';

const fracties = [
	{ key: 'vvd', abbreviation: 'VVD', name: 'VVD', seats: 24, coalition: true },
	{ key: 'nieuw_sociaal_contract', abbreviation: 'NSC', name: 'NSC', seats: 19, coalition: true }
];
const e = (kind: string, factions: string[], words: string | null = null) => ({
	kind,
	date: '2024-07-04',
	words,
	basis: words ? 'tekst' : 'afgeleid',
	factions,
	members: []
});

describe('wijzigingenVan', () => {
	it('gives a derived change its kind as a label, once, with all its fracties', () => {
		const stuk = {
			factions: fracties,
			events: [
				e('opvolging', ['vvd']),
				e('opvolging', ['nieuw_sociaal_contract']),
				e('opvolging', ['vvd'])
			]
		} as never;
		expect(wijzigingenVan(stuk)).toEqual([{ soort: 'Opvolging', wie: 'VVD, NSC' }]);
	});

	it('keeps the Kamer’s own words verbatim, once per headline', () => {
		const kop = 'Twee nieuwe senatoren geïnstalleerd';
		const stuk = {
			factions: fracties,
			events: [e('beëdiging', ['vvd'], kop), e('beëdiging', ['nieuw_sociaal_contract'], kop)]
		} as never;
		expect(wijzigingenVan(stuk)).toEqual([{ woorden: kop }]);
	});

	it('names a fractie it does not know by its key', () => {
		const stuk = { factions: fracties, events: [e('vacature', ['bbb'])] } as never;
		expect(wijzigingenVan(stuk)).toEqual([{ soort: 'Vacature', wie: 'bbb' }]);
	});
});

describe('vacantZonderFractie (UX #48)', () => {
	const f = (seats: number, vacant: number, coalition: boolean) => ({ seats, vacant, coalition });

	it('counts the vacant seats no fractie holds', () => {
		// kabinet-Jetten, 23 Feb 2026: 65 + 84 seats, 11 vacant of which 10 are the fracties'.
		const stuk = { vacant: 11, factions: [f(65, 4, true), f(84, 6, false)] };
		expect(vacantZonderFractie(stuk)).toBe(1);
		expect(65 + 84 + vacantZonderFractie(stuk)).toBe(150);
	});

	it('is the whole vacant count when no fractie has one', () => {
		// kabinet-Rutte III, 16 Jul 2019: 76 + 70 seats, 4 vacant and none a fractie's.
		expect(vacantZonderFractie({ vacant: 4, factions: [f(76, 0, true), f(70, 0, false)] })).toBe(4);
	});

	it('is none when every vacancy is a fractie’s, or the API gives none', () => {
		expect(vacantZonderFractie({ vacant: 1, factions: [f(66, 1, true)] })).toBe(0);
		expect(vacantZonderFractie({ factions: [f(66, 0, true)] } as never)).toBe(0);
		expect(vacantZonderFractie({ vacant: 0, factions: [f(66, 2, true)] })).toBe(0);
	});
});
