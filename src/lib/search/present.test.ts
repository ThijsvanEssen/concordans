import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { around, bySection, marked, presentHit, sectionOf } from './present';

type Hit = Schema<'SearchResultItem'>;
const hit = (h: Partial<Hit> & Pick<Hit, 'collection' | 'key'>): Hit =>
	({ id: `${h.collection}/${h.key}`, type: '', display_name: null, score: 1, ...h }) as Hit;

const TITLE = 'Aanvulling van de Algemene wet bestuursrecht met bepalingen over nadeelcompensatie';
const stuk = (key: string, kind: string, dossier = '32621') =>
	hit({
		collection: 'documents',
		key,
		display_name: TITLE,
		snippet: kind,
		extra: { kind, dossier_number: dossier }
	});

describe('presentHit', () => {
	it('gives an article its book number, the code it is cited by, and a line of its text', () => {
		const shown = presentHit(
			hit({
				collection: 'articles',
				key: 'bwbr0005289_164',
				snippet: 'kan aan hem niet als een onrechtmatige daad worden toegerekend.',
				extra: {
					bwb_id: 'BWBR0005289',
					article_number: '164',
					citation_title: 'Burgerlijk Wetboek Boek 6',
					short_title: 'BW6'
				}
			}),
			'onrechtmatige daad'
		);
		expect(shown.title).toBe('Artikel 6:164');
		expect(shown.context).toBe('BW');
		expect(shown.snippet?.filter((s) => s.mark).map((s) => s.text)).toEqual([
			'onrechtmatige',
			'daad'
		]);
	});

	it('names a judgment by its court and date, with the ECLI beside it', () => {
		const shown = presentHit(
			hit({
				collection: 'judgments',
				key: 'ecli_nl_hr_1993_zc0870',
				display_name: 'Hoge Raad 1993-02-19 / 14892',
				snippet: 'Onrechtmatige daad overheid.',
				extra: { ecli: 'ECLI:NL:HR:1993:ZC0870', names: [] }
			}),
			'daad'
		);
		expect(shown.title).toBe('Hoge Raad, 19 februari 1993');
		expect(shown.context).toBe('ECLI:NL:HR:1993:ZC0870');
		expect(shown.snippet).not.toBeNull();
	});

	it('names a stuk by its kind, under the dossier it belongs to', () => {
		const shown = presentHit(stuk('a', 'Nader rapport'), 'nadeel');
		expect(shown.title).toBe('Nader rapport');
		expect(shown.snippet).toBeNull();
		expect(sectionOf(stuk('a', 'Eindtekst'))).toBe(`32621 ${TITLE}`);
	});

	it('gives a stuk its number in the dossier, where the API has one', () => {
		const amendement = hit({
			collection: 'documents',
			key: 'b',
			display_name: TITLE,
			extra: { kind: 'Amendement', dossier_number: '37022', sequence: '8' }
		});
		expect(presentHit(amendement, 'x').title).toBe('Amendement, nr. 8');
	});
});

describe('bySection', () => {
	it('keeps the stukken of one dossier together, in the order the dossiers first appear', () => {
		const order = bySection([
			stuk('a', 'Eindtekst'),
			stuk('b', 'Brief', '36000'),
			stuk('c', 'Amendement')
		]).map((h) => h.key);
		expect(order).toEqual(['a', 'c', 'b']);
	});
});

describe('around', () => {
	it('starts the line a little before the first word searched for', () => {
		const text = `${'Een gedraging van een kind dat de leeftijd van veertien jaren nog niet heeft bereikt, kan aan hem niet als een'} onrechtmatige daad worden toegerekend.`;
		const line = around(text, 'onrechtmatige');
		expect(line.startsWith('…')).toBe(true);
		expect(line.indexOf('onrechtmatige')).toBeLessThanOrEqual(42);
		expect(around('Onrechtmatige daad overheid.', 'daad')).toBe('Onrechtmatige daad overheid.');
	});
});

describe('marked', () => {
	it('leaves short words and other text alone', () => {
		expect(marked('art. 6:162 BW', 'bw')).toEqual([{ text: 'art. 6:162 BW', mark: false }]);
	});
});
