import { describe, expect, it } from 'vitest';
import { moveIndex, readingOrder } from './canvas-keys';

describe('moveIndex', () => {
	it('steps with the arrows and jumps with Home and End, without wrapping', () => {
		expect(moveIndex('ArrowDown', 0, 3)).toBe(1);
		expect(moveIndex('ArrowDown', 2, 3)).toBe(2);
		expect(moveIndex('ArrowUp', 0, 3)).toBe(0);
		expect(moveIndex('End', 0, 3)).toBe(2);
		expect(moveIndex('Home', 2, 3)).toBe(0);
		expect(moveIndex('Enter', 1, 3)).toBeNull();
		expect(moveIndex('ArrowDown', 0, 0)).toBeNull();
	});
});

describe('readingOrder', () => {
	it('reads the selected bron first, then the rest by name', () => {
		const nodes = [
			{ id: 'b', label: 'Artikel 289' },
			{ id: 'a', label: 'Artikel 287' },
			{ id: 's', label: 'Wetboek van Strafrecht' },
			{ id: 'c', label: 'Artikel 29' }
		];
		expect(readingOrder(nodes, 's').map((n) => n.id)).toEqual(['s', 'c', 'a', 'b']);
	});

	it('sorts numbers as numbers, the Dutch way', () => {
		const labels = ['Artikel 2a', '10', 'Artikel 10', '2', 'artikel 2', 'Artikel 2'];
		const nodes = labels.map((label, i) => ({ id: String(i), label }));
		expect(readingOrder(nodes, null).map((n) => n.label)).toEqual([
			'2',
			'10',
			'artikel 2',
			'Artikel 2',
			'Artikel 2a',
			'Artikel 10'
		]);
	});
});
