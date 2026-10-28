import { describe, expect, it } from 'vitest';
import { axisYears, busiest, countParts, sumPeriod, kindOf, perYear } from './strook';

describe('the strip numbers', () => {
	it('counts per year and kind, changes apart', () => {
		const y = perYear(
			[
				{ jaar: 2020.1, collection: 'judgments' },
				{ jaar: 2020.5, collection: 'judgments' },
				{ jaar: 2021.2, collection: 'documents' },
				{ jaar: 2021.9, collection: 'instruments', change: 'Stb. 2021, 1' }
			],
			2020,
			2022
		);
		expect(y.map((a) => a.total)).toEqual([2, 1, 0]);
		expect(y[1].changes).toEqual(['Stb. 2021, 1']);
		expect(busiest(y)).toBe(2);
		const { per, changes } = sumPeriod(y, 2020, 2021);
		expect(countParts(per, changes).map((p) => p.text)).toEqual([
			'2 uitspraken',
			'1 stuk',
			'1 wijziging'
		]);
	});
	it('puts every collection of the canvas in one kind or none', () => {
		expect(kindOf('articles')).toBe('wetten');
		expect(kindOf('judgments')).toBe('rechtspraak');
	});
	it('names the first and last year always and never two names touching', () => {
		for (const width of [200, 343, 900, 1100]) {
			for (const [a, b] of [
				[2007, 2026],
				[1990, 2026],
				[2024, 2026],
				[1838, 2026]
			]) {
				const ax = axisYears(a, b, width);
				expect(ax[0]).toEqual({ jaar: a, align: 'start' });
				expect(ax.at(-1)).toEqual({ jaar: b, align: 'end' });
				const col = width / (b - a + 1);
				const boxes = ax.map((y) => {
					const c = (y.jaar - a + 0.5) * col;
					return y.align === 'start'
						? [0, 30]
						: y.align === 'end'
							? [width - 30, width]
							: [c - 15, c + 15];
				});
				for (let i = 1; i < boxes.length; i++)
					expect(boxes[i][0]).toBeGreaterThanOrEqual(boxes[i - 1][1]);
			}
		}
	});
});
