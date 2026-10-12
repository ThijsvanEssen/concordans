import { describe, expect, it } from 'vitest';
import { vacantZonderFractie, wijzigingenVan, zaalMetPlan, zetelHoogte } from './zetels';

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

	it('sets the Kamer’s words as a clause: no space before a stop, no stop of their own', () => {
		// Eerste Kamer, 9 Sep 2026: "… de naam van de fractie GroenLinks-PvdA ." (Thijs, 12 Oct).
		const stuk = {
			factions: fracties,
			events: [
				e(
					'hernoeming',
					['vvd'],
					'Van 13 juni 2023 tot 9 september 2026 was de naam van de fractie GroenLinks-PvdA .'
				)
			]
		} as never;
		expect(wijzigingenVan(stuk)).toEqual([
			{
				woorden: 'Van 13 juni 2023 tot 9 september 2026 was de naam van de fractie GroenLinks-PvdA'
			}
		]);
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

describe('zetelHoogte: the step chart on the Kamer’s whole scale (Thijs, 12 Oct)', () => {
	const H = 72;
	const PAD = 4;
	const deel = (y: number) => (H - PAD - y) / (H - 2 * PAD);

	it('puts the majority at its true height: 76 of 150, 38 of 75', () => {
		expect(deel(zetelHoogte(76, 150, H, PAD))).toBeCloseTo(76 / 150);
		expect(deel(zetelHoogte(38, 75, H, PAD))).toBeCloseTo(38 / 75);
		// One scale for both Kamers: their majorities stand at about one height.
		expect(Math.abs(zetelHoogte(76, 150, H, PAD) - zetelHoogte(38, 75, H, PAD))).toBeLessThan(1);
	});

	it('keeps a coalition under the majority under its line, and none at the foot', () => {
		// kabinet-Jetten: 66 of 150, 24 of 75.
		expect(zetelHoogte(66, 150, H, PAD)).toBeGreaterThan(zetelHoogte(76, 150, H, PAD));
		expect(deel(zetelHoogte(66, 150, H, PAD))).toBeCloseTo(66 / 150);
		expect(zetelHoogte(24, 75, H, PAD)).toBeGreaterThan(zetelHoogte(38, 75, H, PAD));
		expect(zetelHoogte(0, 150, H, PAD)).toBe(H - PAD);
		expect(zetelHoogte(150, 150, H, PAD)).toBe(PAD);
		// A sum over the Kamer's seats (Schoof, 25 Jul 2025: 152) stays in the frame.
		expect(zetelHoogte(152, 150, H, PAD)).toBe(PAD);
	});
});

describe('zaalMetPlan: the Eerste Kamer’s seats in its hall', () => {
	const stoel = { block: 'left', row: 0, column: 0, faction: 'vvd', abbreviation: 'VVD' };
	const zaal = (seats: unknown[] | null) =>
		({ chamber: 'EK', factions: [], hall: seats ? { seats } : null }) as never;

	it('takes today’s plan when the day’s hall has none (the API reads it only without a date)', () => {
		const dag = zaal(null);
		const nu = zaal(Array.from({ length: 75 }, () => stoel));
		expect(zaalMetPlan(dag, nu).hall?.seats).toHaveLength(75);
	});

	it('keeps the day’s own hall, and has none where neither gives one', () => {
		const dag = zaal([stoel]);
		expect(zaalMetPlan(dag, zaal([stoel, stoel])).hall?.seats).toHaveLength(1);
		expect(zaalMetPlan(zaal(null), null).hall).toBeNull();
	});
});
