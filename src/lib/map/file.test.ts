import { describe, expect, it } from 'vitest';
import { itemKey, type Annotation, type Map, type MapItem } from './map';
import { FILE_VERSION, NEWER, mapFile, mapFileName, readMapFile, type FileMap } from './file';
import { BROKEN } from './share';

const lid: MapItem = {
	id: 'articles/bwbr0005290_658',
	at: 'lid-1',
	kort: 'art. 7:658 lid 1 BW',
	groep: 'Burgerlijk Wetboek Boek 7',
	groupKey: 'wet:bwbr0005290',
	notitie: 'zorgplicht, ook thuis?'
};
const boek: MapItem = {
	id: 'external:ab12cd34',
	at: '',
	kort: 'Asser/Heerma van Voss & Van Slooten 7-V 2022/321',
	groep: 'Andere bronnen',
	groupKey: 'groep:Andere bronnen',
	kind: 'book'
};
const map: Map = {
	id: 'k3j2h1g0',
	naam: 'Aansprakelijkheid werkgever',
	items: [lid, boek],
	volgorde: 'eigen',
	gewijzigd: '2026-10-19T10:00:00.000Z',
	notitie: 'Valt een RSI-klacht bij thuiswerk onder 7:658 BW?',
	groepNotities: { 'wet:bwbr0005290': 'Arbeidsrecht', 'wet:bwbr0000000': 'weg' }
};

describe('a bundel as a file', () => {
	it('writes its bundels with a version, and reads them back the same', () => {
		const text = mapFile([map]);
		const parsed = JSON.parse(text);
		expect(parsed.concordans).toBe('bundels');
		expect(parsed.versie).toBe(FILE_VERSION);
		expect(readMapFile(text)).toEqual([
			{
				id: map.id,
				naam: map.naam,
				items: [lid, boek],
				volgorde: 'eigen',
				notitie: map.notitie,
				groepNotities: { 'wet:bwbr0005290': 'Arbeidsrecht' },
				verwijzingen: {},
				aantekeningen: [],
				skipped: 0
			}
		]);
	});

	it('holds the aantekeningen and the version of a text kept, in the same version of the file', () => {
		const metVersie = { ...lid, versie: '2024-01-01' };
		const arcering: Annotation = {
			id: 'a-4rc3r1ng',
			op: itemKey(metVersie),
			fragment: { waar: 'lid-1', exact: 'zorgplicht', start: 4 }
		};
		const text = mapFile([{ ...map, items: [metVersie, boek], aantekeningen: [arcering] }]);
		expect(JSON.parse(text).versie).toBe(1);
		const [read] = readMapFile(text) as FileMap[];
		expect(read.items).toEqual([metVersie, boek]);
		expect(read.aantekeningen).toEqual([arcering]);
	});

	it('holds several bundels in one file', () => {
		const other = { ...map, id: 'zz', naam: 'Tweede', items: [lid], volgorde: 'groep' as const };
		expect((readMapFile(mapFile([map, other])) as { naam: string }[]).map((m) => m.naam)).toEqual([
			'Aansprakelijkheid werkgever',
			'Tweede'
		]);
	});

	it('leaves out an item in a broken form, and counts it', () => {
		const text = mapFile([{ ...map, items: [lid, { ...boek, groupKey: '' }] }]);
		const [read] = readMapFile(text) as { items: MapItem[]; skipped: number }[];
		expect(read.items).toEqual([lid]);
		expect(read.skipped).toBe(1);
	});

	it('says a file is no file of bundels, or of a newer version', () => {
		expect(readMapFile('niet json')).toBe(BROKEN);
		expect(readMapFile('{"items": []}')).toBe(BROKEN);
		expect(readMapFile(JSON.stringify({ concordans: 'bundels', versie: 1 }))).toBe(BROKEN);
		expect(
			readMapFile(JSON.stringify({ concordans: 'bundels', versie: FILE_VERSION + 1, bundels: [] }))
		).toBe(NEWER);
	});

	it('is named after its bundel, or Bundels for all of them', () => {
		expect(mapFileName([map])).toBe('Aansprakelijkheid werkgever.json');
		expect(mapFileName([map, map])).toBe('Bundels.json');
		expect(mapFileName([{ ...map, naam: 'a/b: c?' }])).toBe('a b c.json');
	});
});
