import { describe, expect, it } from 'vitest';
import { segmentsOf, withMarkers, type Segment, type Span } from './segments';
import type { Definitie } from './begrippen';
import type { DelegatieSpan } from './delegaties';

// Golden tests on how CitedText cuts a text: what is a link, to what, and where a footnote
// and the marked words of a verbinding fall.

const artikel = (nr: string, start: number, end: number, over: Partial<Span> = {}): Span =>
	({
		start,
		end,
		text: null,
		kind: 'article',
		aanhef: false,
		target: {
			id: `articles/x_${nr}`,
			key: `x_${nr}`,
			collection: 'articles',
			bwb_id: 'x',
			article_number: nr,
			display_name: null
		},
		...over
	}) as Span;

const wet = { ref: 'def-wet', term: 'wet', article_key: 'x_1' } as unknown as Definitie;

/** Each segment as its words and what it is: `art 2`, `begrip`, `formule`, `noot 1`, or text. */
const lees = (segs: Segment[]) =>
	segs.map((s) => {
		const soort = s.noot
			? `noot ${s.noot.label}`
			: s.span
				? `art ${s.span.target.article_number}${s.at ? ` ${s.at}` : ''}`
				: s.begrip
					? 'begrip'
					: s.formule
						? 'formule'
						: '';
		return [s.content, soort, ...(s.gemarkeerd ? ['gemarkeerd'] : [])];
	});

describe('segmentsOf', () => {
	it('splits one span for several articles into a link at each number, each article once', () => {
		const text = 'Gelet op art. 2 en 8 EVRM is dit zo.';
		const citations = [artikel('2', 9, 25), artikel('8', 9, 25), artikel('2', 9, 25)];
		expect(lees(segmentsOf(text, { citations }))).toEqual([
			['Gelet op ', ''],
			['art. 2', 'art 2'],
			[' en ', ''],
			['8', 'art 8'],
			[' EVRM', ''],
			[' is dit zo.', '']
		]);
	});

	it('links at the lid the span names, else the lid the text names after it', () => {
		const text = 'Zie artikel 3, tweede lid, en artikel 4.';
		const citations = [artikel('3', 4, 13), artikel('4', 30, 39, { leden: ['1'] })];
		expect(lees(segmentsOf(text, { citations }))).toEqual([
			['Zie ', ''],
			['artikel 3', 'art 3 lid-2'],
			[', tweede lid, en ', ''],
			['artikel 4', 'art 4 lid-1'],
			['.', '']
		]);
	});

	it('puts a citation before a formula before a term, and a term inside a citation in it', () => {
		const text = 'De wet: artikel 5 van de wet, bij algemene maatregel van bestuur.';
		const formule = { start: 30, end: 64, bij: 30 } as unknown as DelegatieSpan;
		const definities = new Map([[wet.ref, wet]]);
		const begrip = (start: number) => ({
			start,
			end: start + 3,
			term: 'wet',
			definition_ref: wet.ref
		});
		const segs = segmentsOf(text, {
			citations: [artikel('5', 8, 28)],
			begrippen: [begrip(3), begrip(25), { ...begrip(30), definition_ref: 'onbekend' }],
			definities,
			delegaties: [formule]
		});
		expect(lees(segs)).toEqual([
			['De ', ''],
			['wet', 'begrip'],
			[': ', ''],
			['artikel 5 van de wet', 'art 5'],
			[', ', ''],
			['bij algemene maatregel van bestuur', 'formule'],
			['.', '']
		]);
	});

	it('leaves a term without its definition as text, said once', () => {
		const segs = segmentsOf('De wet.', {
			begrippen: [{ start: 3, end: 6, term: 'wet', definition_ref: 'onbekend' }]
		});
		expect(lees(segs)).toEqual([['De wet.', '']]);
	});
});

describe('withMarkers', () => {
	const text = 'Zie artikel 3 en de rest van de zin.';
	const segs = segmentsOf(text, { citations: [artikel('3', 4, 13)] });

	it('leaves the segments as they are without notes or marked words', () => {
		expect(withMarkers(segs, text, [], null)).toBe(segs);
	});

	it('sets a note after the words before it, after a link it falls in, and at the end', () => {
		const noten = [
			{ id: 'n2', label: '2', at: 20 },
			{ id: 'n1', label: '1', at: 8 },
			{ id: 'n3', label: '3', at: null }
		];
		expect(lees(withMarkers(segs, text, noten, null))).toEqual([
			['Zie ', ''],
			['artikel 3', 'art 3'],
			['', 'noot 1'],
			[' en de ', ''],
			['', 'noot 2'],
			['rest van de zin.', ''],
			['', 'noot 3']
		]);
	});

	it('marks the words of a range, cutting text at its edges and a link whole', () => {
		expect(lees(withMarkers(segs, text, [], { start: 2, end: 8 }))).toEqual([
			['Zi', ''],
			['e ', '', 'gemarkeerd'],
			['artikel 3', 'art 3', 'gemarkeerd'],
			[' en de rest van de zin.', '']
		]);
	});
});
