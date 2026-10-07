import { describe, expect, it } from 'vitest';
import { axisLabels } from './years-axis';

const range = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

describe('axisLabels', () => {
	const years = range(1987, 2026);

	it('names the first and the last year and the decades with room around them', () => {
		// 343px over 40 columns: a label takes 4 columns.
		const shown = axisLabels(years, 343).filter(Boolean);
		expect(shown).toEqual(['1987', '2000', '2010', '2020', '2026']);
	});

	it('leaves out a decade too close to the end on a narrow screen', () => {
		// 160px: a label takes 8 columns; 2020 is 6 from 2026, 1990 is 3 from 1987.
		expect(axisLabels(years, 160).filter(Boolean)).toEqual(['1987', '2000', '2010', '2026']);
	});

	it('names every decade before the width is known', () => {
		expect(axisLabels(years, 0).filter(Boolean)).toEqual([
			'1987',
			'1990',
			'2000',
			'2010',
			'2020',
			'2026'
		]);
	});
});
