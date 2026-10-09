import { describe, expect, it } from 'vitest';
import { stap } from './rijen';

describe('rijen', () => {
	it('starts at the first row with J and the last with K', () => {
		expect(stap(-1, 5, 1)).toBe(0);
		expect(stap(-1, 5, -1)).toBe(4);
	});

	it('steps one row and stays inside the list', () => {
		expect(stap(2, 5, 1)).toBe(3);
		expect(stap(4, 5, 1)).toBe(4);
		expect(stap(0, 5, -1)).toBe(0);
		expect(stap(-1, 0, 1)).toBe(-1);
	});
});
