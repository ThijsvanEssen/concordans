import { describe, expect, it } from 'vitest';
import { RIJEN_150, RIJEN_75, deelStoelen, stemVanStoel } from './stoel';

const stemming = { d66: 'tegen', vvd: 'voor' } as const;

describe('a seat of the hall on one stemming', () => {
	it('shows its fractie’s side, and fades where the fractie took no part', () => {
		expect(stemVanStoel({ faction: { key: 'd66' } }, stemming)).toBe('tegen');
		expect(stemVanStoel({ faction: { key: 'vvd' } }, stemming)).toBe('voor');
		expect(stemVanStoel({ faction: { key: 'pvv' } }, stemming)).toBe('niet');
		expect(stemVanStoel({ faction: { key: 'd66' } }, null)).toBeNull();
	});

	it('shows no vote on a vacant seat (UX-toets 0.79.44, #39)', () => {
		expect(stemVanStoel({ leeg: true, faction: { key: 'd66' } }, stemming)).toBeNull();
		expect(stemVanStoel({ leeg: true, faction: null }, stemming)).toBeNull();
	});
});

describe('the seats of the hall (UX #48)', () => {
	const plekken = Array.from({ length: RIJEN_150.reduce((n, r) => n + r, 0) }, (_, i) => ({ i }));
	const fr = (key: string, seats: number, vacant = 0) => ({ key, seats, vacant });

	it('has 150 places for the Tweede Kamer and 75 for the Eerste', () => {
		expect(plekken).toHaveLength(150);
		expect(RIJEN_75.reduce((n, r) => n + r, 0)).toBe(75);
	});

	it('draws exactly 150 seats when held, fractie-vacant and loose vacant seats sum to 150', () => {
		// kabinet-Jetten, 23 Feb 2026: 139 held, 10 vacant of the fracties, 1 of none.
		const stoelen = deelStoelen(plekken, [fr('d66', 70, 4), fr('pvv', 69, 6)], 1);
		expect(stoelen).toHaveLength(150);
		expect(stoelen.filter((s) => s.leeg)).toHaveLength(11);
		expect(stoelen.filter((s) => s.faction === null)).toHaveLength(1);
		expect(stoelen.at(-1)).toMatchObject({ faction: null, leeg: true });
	});

	it('gives a fractie its vacant seats beside its own, the loose ones after all fracties', () => {
		const stoelen = deelStoelen(plekken.slice(0, 6), [fr('a', 2, 1), fr('b', 1)], 2);
		expect(stoelen.map((s) => `${s.faction?.key ?? '-'}${s.leeg ? '_' : ''}`)).toEqual([
			'a',
			'a',
			'a_',
			'b',
			'-_',
			'-_'
		]);
	});

	it('never draws more seats than places', () => {
		expect(deelStoelen(plekken, [fr('a', 149, 1)], 4)).toHaveLength(150);
	});
});
