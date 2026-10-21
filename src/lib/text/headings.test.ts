import { describe, expect, it } from 'vitest';
import { withHeadings } from './headings';

describe('withHeadings', () => {
	const text = 'Lijst I\nAcetorfine\nAlfacetylmethadol';
	const block = { start: 0, end: text.length, table: null };
	const words = (pieces: { start: number; end: number; heading: boolean }[]) =>
		pieces.map((p) => [text.slice(p.start, p.end), p.heading]);

	it('sets a heading apart from the text after it', () => {
		expect(words(withHeadings(text, block, [{ start: 0, end: 7 }]))).toEqual([
			['Lijst I', true],
			['Acetorfine\nAlfacetylmethadol', false]
		]);
	});

	it('keeps a block without headings, and one whose heading lies outside it, whole', () => {
		expect(words(withHeadings(text, block, []))).toEqual([[text, false]]);
		const later = { start: 8, end: text.length, table: null };
		expect(withHeadings(text, later, [{ start: 0, end: 7 }])).toEqual([
			{ ...later, heading: false }
		]);
	});

	it('cuts at a heading in the middle', () => {
		expect(words(withHeadings(text, block, [{ start: 8, end: 18 }]))).toEqual([
			['Lijst I', false],
			['Acetorfine', true],
			['Alfacetylmethadol', false]
		]);
	});
});
