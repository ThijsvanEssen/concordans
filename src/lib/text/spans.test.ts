import { describe, expect, it } from 'vitest';
import { spansWithin } from './spans';

describe('spansWithin', () => {
	it('keeps the spans inside a window, with offsets in it and their own fields', () => {
		const spans = [
			{ start: 2, end: 6, term: 'voor' },
			{ start: 10, end: 13, term: 'wet' },
			{ start: 40, end: 50, term: 'over de rand' },
			{ start: 60, end: 63, term: 'na' }
		];
		expect(spansWithin(spans, 5, 40)).toEqual([{ start: 5, end: 8, term: 'wet' }]);
	});

	it('keeps a span that fills the window exactly, and drops one without offsets', () => {
		const spans = [
			{ start: 5, end: 45, id: 'a' },
			{ start: null, end: null, id: 'b' },
			{ start: 6, end: null, id: 'c' }
		];
		expect(spansWithin(spans, 5, 40)).toEqual([{ start: 0, end: 40, id: 'a' }]);
	});
});
