import { describe, expect, it } from 'vitest';
import { faseRegels, ms, randen, streepjes } from './tijdas';

// Schoof: 2 Jul 2024 to 23 Feb 2026.
const schoof = { van: ms('2024-07-02'), tot: ms('2026-02-23'), lopend: false };

describe('streepjes', () => {
	it('marks the quarters where the width allows, clear of the edges', () => {
		expect(streepjes(schoof, 800).map((t) => t.label)).toEqual([
			'okt.\u00a02024',
			'2025',
			'apr.\u00a02025',
			'jul.\u00a02025',
			'okt.\u00a02025',
			'2026'
		]);
	});

	it('takes a longer step on a narrow axis, so no two labels meet', () => {
		const smal = streepjes(schoof, 200);
		expect(smal.map((t) => t.label)).toEqual(['2025']);
		const sinds1945 = { van: ms('1945-06-25'), tot: ms('2026-10-12'), lopend: true };
		const ticks = streepjes(sinds1945, 600);
		for (let i = 1; i < ticks.length; i++)
			expect((ticks[i].at - ticks[i - 1].at) * 600).toBeGreaterThanOrEqual(56);
		expect(ticks.every((t) => t.at * 600 >= 40 && t.at * 600 <= 560)).toBe(true);
	});
});

describe('randen', () => {
	it('ends a running period on "nu"', () => {
		expect(randen('2026-02-23', null, true)).toEqual({
			begin: '23\u00a0feb.\u00a02026',
			eind: 'nu'
		});
		expect(randen('2024-07-02', '2026-02-23', false).eind).toBe('23\u00a0feb.\u00a02026');
	});
});

describe('faseRegels', () => {
	it('puts a name that would meet the one before a line lower, and turns it inward at the edge', () => {
		const r = faseRegels(
			[
				{ at: 0.6, label: 'Demissionair' },
				{ at: 0.65, label: 'Dubbel demissionair' }
			],
			300
		);
		expect(r.map((f) => f.regel)).toEqual([0, 1]);
		expect(r[1].binnen).toBe(true);
	});
});
