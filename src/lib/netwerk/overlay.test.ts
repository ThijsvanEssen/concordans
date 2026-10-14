import { describe, expect, it } from 'vitest';
import {
	DEFAULT_HEAT_MONTHS,
	HEAT_PERIODS,
	overlayParam,
	parseOverlay,
	type Overlay
} from './overlay';

describe('the overlay parameter', () => {
	it('reads back what it writes, for every kind', () => {
		const overlays: Overlay[] = [
			{ kind: 'none' },
			{ kind: 'open' },
			{ kind: 'dossier', id: '36410' },
			...HEAT_PERIODS.map((months) => ({ kind: 'heat' as const, months }))
		];
		for (const o of overlays) expect(parseOverlay(overlayParam(o))).toEqual(o);
	});

	it('writes no parameter without an overlay', () => {
		expect(overlayParam({ kind: 'none' })).toBeNull();
	});

	it('takes the default period for one it does not offer', () => {
		for (const param of ['heat:0', 'heat:-3', 'heat:999', 'heat:x'])
			expect(parseOverlay(param)).toEqual({ kind: 'heat', months: DEFAULT_HEAT_MONTHS });
		expect(overlayParam({ kind: 'heat', months: 7 })).toBe(`heat:${DEFAULT_HEAT_MONTHS}`);
	});
});
