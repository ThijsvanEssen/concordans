import { describe, expect, it } from 'vitest';
import { divisionAnchor, namesOwnDivision, referenceSpans, type Reference } from './references';
import { segmentsOf, type Span } from './segments';

// Art. 1.2 Wet IB 2001 as the API gives it (15 Oct): eleven references, four citations.
const ref = (
	start: number,
	end: number,
	bwb: string | null,
	article: string | null,
	doc: string,
	over: Partial<Reference> = {}
): Reference => ({
	leden: [],
	onderdelen: [],
	aanhef: false,
	kind: 'extref',
	bwb_id: bwb,
	article,
	doc,
	text: '',
	start,
	end,
	...over
});

const cited = (start: number, end: number, key: string, bwb: string, nr: string): Span =>
	({
		start,
		end,
		text: null,
		leden: [],
		onderdelen: [],
		aanhef: false,
		kind: 'article',
		reference_kind: 'extref',
		confidence: 1,
		definition_ref: null,
		target: {
			id: `articles/${key}`,
			key,
			collection: 'articles',
			bwb_id: bwb,
			official_id: null,
			article_number: nr,
			display_name: null
		}
	}) satisfies Span;

const AWR = 'jci1.3:c:BWBR0002320&artikel=5a';
const citations = [cited(4298, 4352, 'bwbr0002320_5a', 'BWBR0002320', '5a')];

describe('referenceSpans', () => {
	it('links every mention of an article a citation resolved, each at its own lid', () => {
		const spans = referenceSpans(citations, [
			ref(20, 74, 'BWBR0002320', '5a', AWR),
			ref(2144, 2198, 'BWBR0002320', '5a', AWR, { leden: ['2'] }),
			ref(4298, 4352, 'BWBR0002320', '5a', AWR)
		]);
		expect(spans.map((s) => [s.start, s.target.key, s.leden])).toEqual([
			[20, 'bwbr0002320_5a', []],
			[2144, 'bwbr0002320_5a', ['2']],
			[4298, 'bwbr0002320_5a', []]
		]);
	});

	it('links a mention of a law alone to the law', () => {
		const spans = referenceSpans(
			[],
			[ref(3108, 3116, 'BWBR0034925', null, 'jci1.3:c:BWBR0034925')]
		);
		expect(spans).toHaveLength(1);
		expect(spans[0].target).toMatchObject({ collection: 'instruments', key: 'bwbr0034925' });
	});

	it('leaves an article no citation resolved as text: no dead link', () => {
		expect(
			referenceSpans([], [ref(0, 10, 'BWBR0035362', '9.9', 'jci1.3:c:BWBR0035362&artikel=9.9')])
		).toEqual([]);
	});

	it('leaves a reference without a law (a bijlage, an EU act) as text', () => {
		expect(referenceSpans([], [ref(0, 10, null, null, '')])).toEqual([]);
		expect(referenceSpans([], [ref(0, 10, 'BWBR0020368', null, '', { kind: 'intref' })])).toEqual(
			[]
		);
	});

	it('opens a division of its own law at the heading, of another law the law', () => {
		const crumbs = [
			{ type: 'hoofdstuk', label: 'Hoofdstuk 3A.2', anchor: 'deel-3a-hoofdstuk-3a.2' },
			{ type: 'hoofdstuk', label: 'Hoofdstuk IV', anchor: 'deel-hoofdstuk-iv' }
		];
		const own = ref(
			5,
			20,
			'BWBR0020368',
			null,
			'jci1.3:c:BWBR0020368&titeldeel=3a&hoofdstuk=3a.2',
			{
				kind: 'intref'
			}
		);
		const other = ref(30, 60, 'BWBR0007119', null, 'jci1.3:c:BWBR0007119&hoofdstuk=IV');
		const spans = referenceSpans([], [own, other], { ownLaw: 'BWBR0020368', crumbs });
		expect(spans.map((s) => [s.target.key, s.at])).toEqual([
			['bwbr0020368', 'deel-3a-hoofdstuk-3a.2'],
			['bwbr0007119', null]
		]);
		// Without its list the division of the own law stays text.
		expect(referenceSpans([], [own], { ownLaw: 'BWBR0020368' })).toEqual([]);
	});

	it('keeps a citation where a reference overlaps it', () => {
		const spans = referenceSpans(citations, [ref(4300, 4352, 'BWBR0002320', '5a', AWR)]);
		expect(spans).toEqual(citations);
	});

	it('gives CitedText a link at the lid of each mention', () => {
		const text = 'zie artikel 5a, tweede lid, van de AWR en de Jeugdwet.';
		const spans = referenceSpans(
			[cited(4, 14, 'bwbr0002320_5a', 'BWBR0002320', '5a')],
			[
				ref(4, 14, 'BWBR0002320', '5a', AWR, { leden: ['2'] }),
				ref(45, 53, 'BWBR0034925', null, 'jci1.3:c:BWBR0034925')
			]
		);
		const links = segmentsOf(text, { citations: spans }).filter((s) => s.span);
		expect(links.map((s) => [s.content, s.span!.target.collection])).toEqual([
			['artikel 5a', 'articles'],
			['Jeugdwet', 'instruments']
		]);
	});
});

describe('divisionAnchor', () => {
	const crumbs = [{ type: 'hoofdstuk', label: 'Hoofdstuk IV', anchor: 'deel-hoofdstuk-iv' }];
	it('names the innermost layer by its kind and number', () => {
		expect(divisionAnchor('jci1.3:c:BWBR0007119&hoofdstuk=IV', crumbs)).toBe('deel-hoofdstuk-iv');
	});
	it('is null for an article, the law alone or a layer the law lacks', () => {
		expect(divisionAnchor('jci1.3:c:BWBR0007119&hoofdstuk=IV&artikel=16', crumbs)).toBeNull();
		expect(divisionAnchor('jci1.3:c:BWBR0007119', crumbs)).toBeNull();
		expect(divisionAnchor('jci1.3:c:BWBR0007119&hoofdstuk=V', crumbs)).toBeNull();
	});
});

describe('namesOwnDivision', () => {
	it('asks the list of the law only for a division of the law itself', () => {
		const own = ref(0, 5, 'BWBR1', null, 'jci1.3:c:BWBR1&hoofdstuk=2');
		expect(namesOwnDivision([own], 'BWBR1')).toBe(true);
		expect(namesOwnDivision([own], 'BWBR2')).toBe(false);
		expect(namesOwnDivision([ref(0, 5, 'BWBR1', null, 'jci1.3:c:BWBR1')], 'BWBR1')).toBe(false);
	});
});
