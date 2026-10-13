import { describe, expect, it } from 'vitest';
import { aanhalingIn, citeerplaats, uitsnede } from './passage';
import { hoeVan, plaatsIn } from './hoe';
import type { Row } from './rows';

const cut = (text: string, at: { start: number; end: number } | null) =>
	at ? text.slice(at.start, at.end) : null;

describe('citeerplaats', () => {
	it('marks the article with its law where the law follows', () => {
		const t = 'Het besluit is in strijd met artikel 3:2 van de Awb voorbereid.';
		expect(cut(t, citeerplaats(t, '3:2', ['Awb']))).toBe('artikel 3:2 van de Awb');
	});

	it('takes a lid between the number and the law', () => {
		const t = 'gelet op artikel 8:51d, eerste lid, van de Algemene wet bestuursrecht';
		expect(cut(t, citeerplaats(t, '8:51d', ['Awb', 'Algemene wet bestuursrecht']))).toBe(
			'artikel 8:51d, eerste lid, van de Algemene wet bestuursrecht'
		);
	});

	it('prefers the citation that names the law over another law’s article of that number', () => {
		const t = 'Op grond van artikel 12 van de voorwaarden en artikel 12 Cbw is dat zo.';
		expect(citeerplaats(t, '12', ['Cbw'])?.start).toBe(t.indexOf('artikel 12 Cbw'));
	});

	it('marks the article alone where no law follows, and not a longer number', () => {
		const t = 'zie art. 6:1621 en art. 6:162 hierna';
		expect(cut(t, citeerplaats(t, '6:162', ['BW']))).toBe('art. 6:162');
		expect(citeerplaats('artikel 3.4.2 van de regels', '3.4', [])).toBeNull();
	});

	it('does not take a law name that runs on', () => {
		const t = 'artikel 12 van de CBW-voorwaarden';
		expect(cut(t, citeerplaats(t, '12', ['CBW']))).toBe('artikel 12');
	});
});

describe('uitsnede', () => {
	it('starts at the sentence of the mark where that is near', () => {
		const p = uitsnede({
			before:
				'Een eerdere zin over iets heel anders. De rechtbank oordeelt dat het besluit in strijd met ',
			mark: 'artikel 3:2 van de Awb',
			after: ' is voorbereid.'
		});
		expect(p.before).toBe('De rechtbank oordeelt dat het besluit in strijd met ');
		expect(p.after).toBe(' is voorbereid.');
	});

	it('cuts a long sentence at a word, with an ellipsis', () => {
		const before = 'woord '.repeat(30);
		const p = uitsnede({ before, mark: 'art. 1', after: ' en zo '.repeat(60) });
		expect(p.before.startsWith('…woord')).toBe(true);
		expect(p.before.length).toBeLessThanOrEqual(61);
		expect(p.after.endsWith('…')).toBe(true);
	});

	it('does not take an abbreviation with a number for the end of a sentence', () => {
		const p = uitsnede({
			before:
				'zoals de Afdeling eerder overwoog onder r.o. 4.2 en art. 3 lid 2, is het besluit in strijd met ',
			mark: 'artikel 3:2 Awb',
			after: '.'
		});
		expect(p.before.startsWith('…')).toBe(true);
	});
});

describe('aanhalingIn', () => {
	const cited = {
		article: {
			key: 'bwbr0005537_3_2',
			article_number: '3:2',
			instrument: { abbreviation: 'Awb', title: 'Algemene wet bestuursrecht' }
		},
		paragraph_ids: ['rov-6', 'rov-7'],
		snippet: '…in strijd met artikel 3:2 van de Awb.'
	};
	const span = (text: string, words: string, key = 'bwbr0005537_3_2') => ({
		start: text.indexOf(words),
		end: text.indexOf(words) + words.length,
		target: { key }
	});

	it('takes the first overweging whose spans cite the article, with the span’s words', () => {
		const t7 = 'Het besluit is in strijd met artikel 3:2 van de Awb.';
		const paragraphs = [
			{ paragraph_id: 'rov-6', number: '6', text: 'Het beroep is gegrond.', citations: [] },
			{
				paragraph_id: 'rov-7',
				number: '7',
				text: t7,
				citations: [span(t7, 'artikel 3:2 van de Awb')]
			}
		];
		expect(aanhalingIn(cited, paragraphs)).toEqual({
			snippet: t7,
			match: 'artikel 3:2 van de Awb',
			at: 'rov-7'
		});
	});

	it('finds a BW article the API numbers without its book (`305a` for 3:305a)', () => {
		// Urgenda, HR 20 december 2019: `article_number: "305a"`, the span says `art. 3:305a BW`.
		const t = 'Urgenda vordert op grond van art. 3:305a BW een bevel aan de Staat.';
		const bw = {
			article: {
				key: 'bwbr0005291_305a',
				article_number: '305a',
				instrument: { abbreviation: 'BW3', title: 'Burgerlijk Wetboek Boek 3' }
			},
			paragraph_ids: ['p-2b2a0b8a', 'rov-2.2.1'],
			snippet:
				'(f) Kan deze verplichting worden ingeroepen bij een vordering op grond van art. 3:305a BW?'
		};
		const paragraphs = [
			{
				paragraph_id: 'p-2b2a0b8a',
				text: bw.snippet,
				citations: [span(bw.snippet, 'art. 3:305a BW', 'bwbr0005291_305a')]
			},
			{
				paragraph_id: 'rov-2.2.1',
				number: '2.2.1',
				text: t,
				citations: [span(t, 'art. 3:305a BW', 'bwbr0005291_305a')]
			}
		];
		expect(aanhalingIn(bw, paragraphs)).toEqual({
			snippet: t,
			match: 'art. 3:305a BW',
			at: 'rov-2.2.1'
		});
	});

	it('takes a span to another article for no citation of this one', () => {
		const t = 'Gelet op artikel 3:4 Awb en artikel 3:2 Awb is het besluit onzorgvuldig.';
		const paragraphs = [
			{
				paragraph_id: 'rov-7',
				number: '7',
				text: t,
				citations: [span(t, 'artikel 3:4 Awb', 'bwbr0005537_3_4'), span(t, 'artikel 3:2 Awb')]
			}
		];
		expect(aanhalingIn({ ...cited, paragraph_ids: ['rov-7'] }, paragraphs)?.match).toBe(
			'artikel 3:2 Awb'
		);
	});

	it('takes a numbered overweging before the head of the judgment', () => {
		const head = 'Tussenuitspraak met toepassing van artikel 3:2 van de Awb';
		const t7 = 'Gelet op artikel 3:2 Awb is het besluit onzorgvuldig.';
		const paragraphs = [
			{ paragraph_id: 'p-1', text: head, citations: [span(head, 'artikel 3:2 van de Awb')] },
			{ paragraph_id: 'rov-7', number: '7', text: t7, citations: [span(t7, 'artikel 3:2 Awb')] }
		];
		expect(aanhalingIn({ ...cited, paragraph_ids: ['p-1', 'rov-7'] }, paragraphs)?.at).toBe(
			'rov-7'
		);
	});

	it('reads the API’s own place of the strongest mention where it gives one (0.79.54)', () => {
		const t = 'Ingevolge artikel 3:2 van de Awb moet het bestuursorgaan kennis vergaren.';
		const paragraphs = [{ paragraph_id: 'p-9', text: t, citations: [] }];
		const met = {
			...cited,
			paragraph_ids: ['p-9'],
			snippet_paragraph_id: 'p-9',
			start: t.indexOf('artikel'),
			end: t.indexOf(' moet'),
			text: 'artikel 3:2 van de Awb'
		};
		expect(aanhalingIn(met, paragraphs)).toEqual({
			snippet: t,
			match: 'artikel 3:2 van de Awb',
			at: 'p-9'
		});
	});

	it('does not read a paragraph by an `id` the API does not serve', () => {
		const t = 'Het besluit is in strijd met artikel 3:2 van de Awb.';
		const paragraphs = [
			{ paragraph_id: 'p-x', text: t, citations: [span(t, 'artikel 3:2 van de Awb')] }
		];
		expect(aanhalingIn(cited, paragraphs)?.at).toBe('rov-6');
	});

	it('falls back on the API’s snippet', () => {
		expect(aanhalingIn(cited, [])).toEqual({
			snippet: cited.snippet,
			match: 'artikel 3:2 van de Awb',
			at: 'rov-6'
		});
	});
});

describe('the r.o. of the passage in the row’s line', () => {
	it('names the words of the paragraph', () => {
		expect(plaatsIn('in r.o. 3.4', 'rov-3.4')).toEqual({ text: 'r.o. 3.4', at: 'rov-3.4' });
		expect(plaatsIn('in r.o. 3.4 en 5.1', 'rov-5.1')).toEqual({ text: '5.1', at: 'rov-5.1' });
		expect(plaatsIn('in r.o. 3.4', 'rov-3')).toBeNull();
		expect(plaatsIn('in r.o. 3.4', 'p-3f2a9c1e')).toBeNull();
	});

	it('links it in the line of a judgment that cites an article', () => {
		const row: Row = {
			ref: { collection: 'articles', key: 'bwbr0005537_3_2' },
			title: 'Artikel 3:2 Awb',
			context: null,
			kind: 'artikelen',
			relation: 'REFERS_TO',
			direction: 'outbound',
			position: 'r.o. 3.4',
			snippet: 'Het besluit is in strijd met artikel 3:2 van de Awb voorbereid.',
			match: 'artikel 3:2 van de Awb',
			passageAt: 'rov-3.4',
			confidence: 0.95,
			edge: { reason: 'bwb_article', paragraphs: ['3.4'] }
		};
		const hoe = hoeVan(row, 'judgments');
		expect(hoe?.werkwoord).toBe('Aangehaald');
		expect(hoe?.rest).toBe('in r.o. 3.4');
		expect(hoe?.plaats).toEqual({ text: 'r.o. 3.4', at: 'rov-3.4' });
		expect(hoe?.citaat?.mark).toBe('artikel 3:2 van de Awb');
	});
});
