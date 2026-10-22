import { describe, expect, it } from 'vitest';
import { cslJson } from './csl';
import type { MapItem } from './map';

const item = (over: Partial<MapItem>): MapItem => ({
	id: 'articles/bwbr0005289_162',
	at: '',
	kort: 'art. 6:162 BW',
	groep: 'Burgerlijk Wetboek Boek 6',
	groupKey: 'wet:bwbr0005289',
	...over
});

const read = (items: MapItem[], volgorde: 'groep' | 'eigen' = 'eigen') =>
	JSON.parse(cslJson(items, (i) => `https://concordans.nl/${i.id}`, volgorde, '2026-10-22'));

describe('CSL-JSON of a bundel', () => {
	it('writes a judgment as legal_case, with court, ECLI and day', () => {
		const [c] = read([
			item({
				id: 'judgments/ecli_nl_hr_2019_2006',
				kort: 'HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1',
				groep: 'Rechtspraak',
				groupKey: 'judgments/ecli_nl_hr_2019_2006'
			})
		]);
		expect(c).toMatchObject({
			type: 'legal_case',
			title: 'HR 20 december 2019, ECLI:NL:HR:2019:2006',
			authority: 'Hoge Raad',
			number: 'ECLI:NL:HR:2019:2006',
			issued: { 'date-parts': [[2019, 12, 20]] },
			section: 'r.o. 5.7.1',
			accessed: { 'date-parts': [[2026, 10, 22]] },
			URL: 'https://concordans.nl/judgments/ecli_nl_hr_2019_2006'
		});
	});

	it('writes an article as legislation with the day its text held', () => {
		const [c] = read([item({ at: 'lid-2', kort: 'art. 6:162 lid 2 BW', versie: '2024-01-01' })]);
		expect(c).toMatchObject({
			type: 'legislation',
			section: 'lid 2',
			note: 'tekst geldend op 2024-01-01'
		});
	});

	it('writes a Kamerstuk as bill and a source outside Concordans by its kind', () => {
		const out = read([
			item({ id: 'documents/kst-36496-3', kort: 'Kamerstukken II 2023/24, 36496, nr. 3' }),
			item({ id: 'external:abc123', kind: 'book', kort: 'Asser 6-IV', url: 'https://x.nl' })
		]);
		expect(out.map((c: { type: string }) => c.type)).toEqual(['bill', 'book']);
	});
});
