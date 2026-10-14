import { describe, expect, it } from 'vitest';
import type { MapItem } from './map';
import { gemerkt, notitiesPerBron } from './notities';

const cbw = 'Centrale bankenwet (Cbw)';
const lid3: MapItem = {
	id: 'articles/bwbr0052872_21',
	at: 'lid-3',
	kort: 'art. 21 lid 3 Cbw',
	groep: cbw,
	groupKey: 'wet:bwbr0052872',
	notitie: 'De kern.'
};
const lid1: MapItem = { ...lid3, at: 'lid-1', kort: 'art. 21 lid 1 Cbw', notitie: 'Begin.' };
const art22: MapItem = {
	id: 'articles/bwbr0052872_22',
	at: '',
	kort: 'art. 22 Cbw',
	groep: cbw,
	groupKey: 'wet:bwbr0052872'
};
const ro: MapItem = {
	id: 'judgments/ecli_nl_hr_2019_2006',
	at: 'rov-5.7.1',
	kort: 'HR 2019:2006, r.o. 5.7.1',
	groep: 'HR 20 december 2019 (Urgenda)',
	groupKey: 'judgments/ecli_nl_hr_2019_2006',
	notitie: 'Zorgplicht.'
};
const stuk: MapItem = {
	id: 'documents/x',
	at: '',
	kort: 'Kamerstukken II 36764, 3',
	groep: 'Dossier 36764',
	groupKey: 'dossier:36764'
};

const map = (items: MapItem[], extra: object = {}) => ({
	naam: 'Cbw',
	items,
	notitie: null,
	groepNotities: {},
	...extra
});

describe('the notes of a map per bron', () => {
	it('lists each lid of one article with its place, in the map order', () => {
		const per = notitiesPerBron(map([lid3, art22, lid1]));
		expect(per.get('articles/bwbr0052872_21')).toEqual([
			{ waar: 'lid 3', tekst: 'De kern.', soort: 'item' },
			{ waar: 'lid 1', tekst: 'Begin.', soort: 'item' }
		]);
	});

	it('gives an overweging its place and a whole bron none', () => {
		const per = notitiesPerBron(map([ro, { ...stuk, notitie: 'Memorie.' }]));
		expect(per.get(ro.id)).toEqual([{ waar: 'r.o. 5.7.1', tekst: 'Zorgplicht.', soort: 'item' }]);
		expect(per.get(stuk.id)).toEqual([{ waar: null, tekst: 'Memorie.', soort: 'item' }]);
	});

	it('holds nothing for a bron without a note, or one not in the map', () => {
		const per = notitiesPerBron(map([lid3, art22]));
		expect(per.has(art22.id)).toBe(false);
		expect(per.has('articles/bwbr0052872_23')).toBe(false);
		expect(gemerkt(per)).toEqual(new Set([lid3.id]));
	});

	it('adds the note on a group under its name, once per bron; a judgment its own without', () => {
		const per = notitiesPerBron(
			map([lid3, lid1, art22, ro], {
				groepNotities: { 'wet:bwbr0052872': 'Over de Cbw.', [ro.id]: 'Leading case.' }
			})
		);
		expect(per.get(art22.id)).toEqual([{ waar: cbw, tekst: 'Over de Cbw.', soort: 'groep' }]);
		expect(per.get(lid3.id)?.filter((n) => n.soort === 'groep')).toHaveLength(1);
		expect(per.get(ro.id)?.at(-1)).toEqual({ waar: null, tekst: 'Leading case.', soort: 'groep' });
		expect(gemerkt(per)).toEqual(new Set([lid3.id, art22.id, ro.id]));
	});

	it("adds the map's own note last, under the map's name, without a mark of its own", () => {
		const per = notitiesPerBron(map([art22], { notitie: ' De vraag. ' }));
		expect(per.get(art22.id)).toEqual([{ waar: 'Cbw', tekst: 'De vraag.', soort: 'map' }]);
		expect(gemerkt(per).size).toBe(0);
	});
});
