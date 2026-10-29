import { describe, expect, it } from 'vitest';
import { preambleParagraphs, preambleLabel, type Preamble } from './preamble';

const WHO = 'De Staatssecretaris van Economische Zaken en Klimaat,';
const BASIS = 'Gelet op artikel 19 van het Cyberbeveiligingsbesluit;';
const ENACTING = 'Besluit:';
const text = [WHO, BASIS, ENACTING].join('\n');
const at = (s: string) => text.indexOf(s);

const preamble: Preamble = {
	text,
	parts: [
		{ kind: 'wie', start: 0, end: WHO.length },
		{ kind: 'considerans', start: at(BASIS), end: at(BASIS) + BASIS.length },
		{ kind: 'gelet_op', start: at(BASIS), end: at(BASIS) + BASIS.length },
		{ kind: 'afkondiging', start: at(ENACTING), end: text.length }
	],
	references: [
		{
			leden: [],
			onderdelen: [],
			kind: 'extref',
			bwb_id: 'BWBR0052872',
			article: '19',
			celex: null,
			doc: '1.0:c:BWBR0052872&artikel=19',
			text: 'artikel 19',
			start: at('artikel 19'),
			end: at('artikel 19') + 'artikel 19'.length,
			footnote: null,
			target: {
				collection: 'articles',
				key: 'bwbr0052872_19',
				id: 'articles/bwbr0052872_19',
				exists: true
			}
		}
	]
} as unknown as Preamble;

describe('the aanhef', () => {
	it('is a paragraph a line, its references links at their place in the line', () => {
		const [who, basis, enacting] = preambleParagraphs(preamble);
		expect(who).toMatchObject({ text: WHO, citations: [], enacting: false });
		expect(basis.citations).toHaveLength(1);
		const span = basis.citations[0];
		expect(basis.text.slice(span.start!, span.end!)).toBe('artikel 19');
		expect(span.target).toMatchObject({ key: 'bwbr0052872_19', article_number: '19' });
		expect(enacting).toMatchObject({ text: ENACTING, enacting: true });
	});

	it('says nothing where the regulation has none', () => {
		expect(preambleParagraphs(null)).toEqual([]);
		expect(preambleParagraphs({ ...preamble, text: '  ' })).toEqual([]);
	});

	it('leaves a reference to what the data does not hold as text', () => {
		const ref = {
			...preamble.references[0],
			target: { ...preamble.references[0].target!, exists: false }
		};
		expect(preambleParagraphs({ ...preamble, references: [ref] })[1].citations).toEqual([]);
	});

	it('is called the aanhef en considerans of a law', () => {
		expect(preambleLabel('wet')).toBe('Aanhef en considerans');
		expect(preambleLabel('ministeriele-regeling')).toBe('Aanhef');
	});
});
