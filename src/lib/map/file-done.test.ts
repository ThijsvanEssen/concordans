import { describe, expect, it } from 'vitest';
import { mapAfterFile } from './file-done';

const a = { id: 'a' };
const b = { id: 'b' };

describe('the bundel the focus goes to after a choice for a bundel from a file (F2)', () => {
	it('is the new bundel, the one added to, or the one replaced', () => {
		expect(mapAfterFile('map', undefined, b)).toBe('b');
		expect(mapAfterFile('add', a, b)).toBe('a');
		expect(mapAfterFile('add', undefined, b)).toBe('b');
		expect(mapAfterFile('replace', a, b)).toBe('a');
	});

	it('is none where nothing changed', () => {
		expect(mapAfterFile('none', a, b)).toBeNull();
		expect(mapAfterFile('replace', undefined, b)).toBeNull();
	});
});
