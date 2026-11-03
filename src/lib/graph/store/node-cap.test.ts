import { describe, expect, it } from 'vitest';
import { capFrom, SOFT_NODE_CAP } from './types';

describe('?grens', () => {
	it('keeps the soft cap without a valid ask', () => {
		for (const asked of [null, '', 'veel', '12', '5000', '800.5']) {
			expect(capFrom(asked)).toBe(SOFT_NODE_CAP);
		}
	});

	it('takes a whole number from 50 to 2000', () => {
		expect(capFrom('800')).toBe(800);
		expect(capFrom('1000')).toBe(1000);
	});
});
