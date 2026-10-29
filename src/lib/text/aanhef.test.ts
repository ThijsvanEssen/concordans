import { describe, expect, it } from 'vitest';
import { aanhefAlineas, aanhefLabel, type Preamble } from './aanhef';

const WIE = 'De Staatssecretaris van Economische Zaken en Klimaat,';
const GELET = 'Gelet op artikel 19 van het Cyberbeveiligingsbesluit;';
const BESLUIT = 'Besluit:';
const text = [WIE, GELET, BESLUIT].join('\n');
const at = (s: string) => text.indexOf(s);

const preamble: Preamble = {
	text,
	parts: [
		{ kind: 'wie', start: 0, end: WIE.length },
		{ kind: 'considerans', start: at(GELET), end: at(GELET) + GELET.length },
		{ kind: 'gelet_op', start: at(GELET), end: at(GELET) + GELET.length },
		{ kind: 'afkondiging', start: at(BESLUIT), end: text.length }
	],
	references: [
		{
			leden: [],
			onderdelen: [],
			aanhef: false,
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
		const [wie, gelet, besluit] = aanhefAlineas(preamble);
		expect(wie).toMatchObject({ text: WIE, citations: [], besluit: false });
		expect(gelet.citations).toHaveLength(1);
		const span = gelet.citations[0];
		expect(gelet.text.slice(span.start!, span.end!)).toBe('artikel 19');
		expect(span.target).toMatchObject({ key: 'bwbr0052872_19', article_number: '19' });
		expect(besluit).toMatchObject({ text: BESLUIT, besluit: true });
	});

	it('says nothing where the regulation has none', () => {
		expect(aanhefAlineas(null)).toEqual([]);
		expect(aanhefAlineas({ ...preamble, text: '  ' })).toEqual([]);
	});

	it('leaves a reference to what the data does not hold as text', () => {
		const ref = {
			...preamble.references[0],
			target: { ...preamble.references[0].target!, exists: false }
		};
		expect(aanhefAlineas({ ...preamble, references: [ref] })[1].citations).toEqual([]);
	});

	it('is called the aanhef en considerans of a law', () => {
		expect(aanhefLabel('wet')).toBe('Aanhef en considerans');
		expect(aanhefLabel('ministeriele-regeling')).toBe('Aanhef');
	});
});
