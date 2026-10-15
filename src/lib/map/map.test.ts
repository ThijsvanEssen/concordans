import { describe, expect, it } from 'vitest';
import { parseNetwerk } from '$lib/selection/netwerk';
import {
	bewaarItem,
	citaten,
	csv,
	externalItem,
	freeName,
	webAddress,
	isExternal,
	itemAddress,
	readItem,
	groepen,
	itemHref,
	netwerkHref,
	netwerkIds,
	withItems,
	itemKey,
	verschuif,
	type MapItem
} from './map';
import { itemVanRij } from './rij';
import { remember } from '$lib/bron/address';
import type { Row } from '$lib/verbonden/rows';

const lid2: MapItem = {
	id: 'articles/bwbr0005289_162',
	at: 'lid-2',
	kort: 'art. 6:162 lid 2 BW',
	voluit: 'artikel 6:162 lid 2 Burgerlijk Wetboek',
	groep: 'Burgerlijk Wetboek Boek 6',
	groupKey: 'wet:bwbr0005289'
};
const ro: MapItem = {
	id: 'judgments/ecli_nl_hr_2019_2006',
	at: 'rov-5.7.1',
	kort: 'HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1',
	groep: 'HR 20 december 2019 (Urgenda); a~b',
	groupKey: 'judgments/ecli_nl_hr_2019_2006'
};

describe('the map', () => {
	it('keys an item by its bron and its place', () => {
		expect(itemKey(lid2)).toBe('articles/bwbr0005289_162#lid-2');
		expect(itemKey({ id: 'documents/x', at: '' })).toBe('documents/x');
	});

	it('groups in the order things were kept', () => {
		const lid3 = { ...lid2, at: 'lid-3', kort: 'art. 6:162 lid 3 BW' };
		expect(groepen([lid2, ro, lid3]).map((g) => [g.groep, g.items.length])).toEqual([
			['Burgerlijk Wetboek Boek 6', 2],
			['HR 20 december 2019 (Urgenda); a~b', 1]
		]);
	});

	it('keeps one dossier in one group, from the reader, from Verbonden or whole', () => {
		const g = groepen([
			bewaarItem('documents/motie31', { kort: 'Motie' }, { dossier: '36764' }),
			bewaarItem(
				'documents/mvt',
				{ kort: 'MvT' },
				{ groep: 'Kamerstuk 36764 Cyberbeveiligingswet', dossier: '36764' }
			),
			bewaarItem(
				'dossiers/36764',
				{ kort: 'Kamerstukken 36764' },
				{ groep: 'Kamerstuk 36764 Cyberbeveiligingswet', dossier: '36764' }
			)
		]);
		expect(g.map((x) => [x.groep, x.sleutel, x.items.length])).toEqual([
			['Kamerstuk 36764 Cyberbeveiligingswet', 'dossier:36764', 3]
		]);
	});

	it('adds a shared map to its own without doubles', () => {
		expect(withItems([lid2], [lid2, ro]).map(itemKey)).toEqual([itemKey(lid2), itemKey(ro)]);
	});

	it('cites per group, numbered, the full form where there is one', () => {
		expect(citaten([lid2, ro])).toBe(
			'Burgerlijk Wetboek Boek 6\n1. artikel 6:162 lid 2 Burgerlijk Wetboek\n\nHR 20 december 2019 (Urgenda); a~b\n2. HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1'
		);
	});

	it('writes a CSV as Excel reads it', () => {
		const t = csv([ro], (i) => `/x#${i.at}`);
		expect(t.startsWith('﻿volgorde;groep;soort;citaat;vindplaats;aantekening;adres\r\n')).toBe(
			true
		);
		expect(t).toContain('"HR 20 december 2019 (Urgenda); a~b"');
	});

	it('writes the CSV per group, in the order of the groups, its places as printed (#56)', () => {
		const lid3a = {
			...lid2,
			at: 'lid-3-onder-a',
			kort: 'art. 6:162 lid 3 BW',
			voluit: null,
			groep: 'BW'
		};
		const regels = (t: string) => t.slice(1).split('\r\n').slice(1);
		const adres = () => '';
		expect(regels(csv([lid2, ro, lid3a], adres))).toEqual([
			'1;Burgerlijk Wetboek Boek 6;Artikel;artikel 6:162 lid 2 Burgerlijk Wetboek;lid 2;;',
			'2;Burgerlijk Wetboek Boek 6;Artikel;art. 6:162 lid 3 BW;lid 3, onder a;;',
			'3;"HR 20 december 2019 (Urgenda); a~b";Uitspraak;HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1;r.o. 5.7.1;;'
		]);
		// In the reader's own order: that order, each under its group's name.
		expect(regels(csv([lid2, ro, lid3a], adres, 'eigen')).map((r) => r.split(';')[1])).toEqual([
			'Burgerlijk Wetboek Boek 6',
			'"HR 20 december 2019 (Urgenda)',
			'Burgerlijk Wetboek Boek 6'
		]);
		// A place the reader cannot print stays out.
		expect(regels(csv([{ ...lid2, at: 'p-54bd15c1' }], adres))[0]).toBe(
			'1;Burgerlijk Wetboek Boek 6;Artikel;artikel 6:162 lid 2 Burgerlijk Wetboek;;;'
		);
	});

	it('carries a note in the citations and the CSV', () => {
		const met = { ...lid2, notitie: 'Drie categorieën; ~ en ; erin' };
		expect(citaten([met])).toContain('\n   Drie categorieën; ~ en ; erin');
		expect(csv([met], () => '')).toContain('Drie categorieën');
	});

	it('cites in the own order of the reader, without groups', () => {
		expect(citaten([ro, lid2], 'eigen')).toBe(
			'1. HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1\n2. artikel 6:162 lid 2 Burgerlijk Wetboek'
		);
	});

	it('moves an item within its group, or among all in its own order', () => {
		const lid3 = { ...lid2, at: 'lid-3', kort: 'lid 3' };
		const lijst = [lid2, ro, lid3];
		expect(verschuif(lijst, itemKey(lid3), -1, 'groep').map((i) => i.at)).toEqual([
			'lid-3',
			'rov-5.7.1',
			'lid-2'
		]);
		expect(verschuif(lijst, itemKey(lid3), -1, 'eigen').map((i) => i.at)).toEqual([
			'lid-2',
			'lid-3',
			'rov-5.7.1'
		]);
		expect(verschuif(lijst, itemKey(lid2), -1, 'eigen')).toEqual(lijst);
	});

	it('puts the note of the map above its citations', () => {
		expect(citaten([lid2], 'eigen', 'Waarom deze map')).toBe(
			'Waarom deze map\n\n1. artikel 6:162 lid 2 Burgerlijk Wetboek'
		);
	});

	it('seeds the network with the bronnen of the map only, each once', () => {
		const lid3 = { ...lid2, at: 'lid-3', kort: 'art. 6:162 lid 3 BW' };
		expect(netwerkIds([lid2, ro, lid3])).toEqual([lid2.id, ro.id]);
		const href = netwerkHref([lid2, ro, lid3])!;
		expect(href).toBe(
			'/explore?netwerk=articles/bwbr0005289_162,judgments/ecli_nl_hr_2019_2006&tussen=0'
		);
		// As the Verkenner reads it: these bronnen on, none between them.
		const n = parseNetwerk(new URL(href, 'https://concordans.nl').searchParams);
		expect(n.ids).toEqual([lid2.id, ro.id]);
		expect(n.tussen).toBe(false);
		expect(n.uit.size).toBe(0);
		expect(netwerkHref([])).toBeNull();
	});

	it("puts a group's note under its name in the citations", () => {
		expect(citaten([lid2, ro], 'groep', null, { 'wet:bwbr0005289': 'Waarom deze wet' })).toBe(
			'Burgerlijk Wetboek Boek 6\nWaarom deze wet\n1. artikel 6:162 lid 2 Burgerlijk Wetboek\n\nHR 20 december 2019 (Urgenda); a~b\n2. HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1'
		);
	});
});

describe('keeping a bron', () => {
	const stuk = 'documents/dba9b180_cb08';

	it('keys a Kamerstuk by its dossier, from a row of a list as from its reader', () => {
		// The row of Bladeren knows the stuk by its title, the reader by its citation.
		const rij = bewaarItem(stuk, { kort: 'Memorie van toelichting' }, { dossier: '36889' });
		const lezer = bewaarItem(
			stuk,
			{ kort: 'Kamerstukken II 2025/26, 36889, nr. 3' },
			{
				dossier: '36889'
			}
		);
		expect(rij.groupKey).toBe('dossier:36889');
		expect(lezer.groupKey).toBe(rij.groupKey);
		expect(groepen([rij, lezer])).toHaveLength(1);
	});

	it('keys a row of Verbonden as its reader keys it', () => {
		const r = {
			ref: { collection: 'documents', key: 'dba9b180_cb08' },
			title: 'Memorie van toelichting',
			context: null,
			filterGroup: 'toelichtingen',
			props: { dossier_numbers: ['36889'] }
		} as Row;
		const lezer = bewaarItem(
			stuk,
			{ kort: 'Kamerstukken II 2025/26, 36889, nr. 3' },
			{
				dossier: '36889'
			}
		);
		expect(itemVanRij(r)!.groupKey).toBe(lezer.groupKey);
	});

	it('keys a vote by the dossier it is in, with the dossier kept whole', () => {
		const stemming = bewaarItem(
			'decisions/abc',
			{ kort: 'Stemming 1 oktober 2026: motie' },
			{ dossier: '36889' }
		);
		const dossier = bewaarItem(
			'dossiers/36889',
			{ kort: 'Kamerstukken 36889' },
			{ dossier: '36889' }
		);
		expect(stemming.groupKey).toBe('dossier:36889');
		expect(dossier.groupKey).toBe('dossier:36889');
		expect(bewaarItem('documents/x', { kort: 'x' }, { dossier: '36600 XV' }).groupKey).toBe(
			'dossier:36600-XV'
		);
	});

	it('keys a person as a Kamerlid, from a member as from a bewindspersoon', () => {
		const lid = bewaarItem('members/a', { kort: 'A' });
		const bewindspersoon = bewaarItem('members/b', { kort: 'B' });
		expect(lid.groep).toBe(bewindspersoon.groep);
		expect(lid.groupKey).toBe(bewindspersoon.groupKey);
	});

	it('keys an article of an act of the EU by its act, not by its name', () => {
		const a = bewaarItem(
			'articles/32016r0679_6',
			{ kort: 'art. 6 AVG' },
			{
				groep: 'AVG',
				wet: '32016R0679'
			}
		);
		const b = bewaarItem(
			'articles/32016r0679_7',
			{ kort: 'art. 7' },
			{
				groep: 'Algemene verordening gegevensbescherming',
				wet: '32016R0679'
			}
		);
		const geheel = bewaarItem(
			'instruments/32016r0679',
			{ kort: 'AVG' },
			{
				groep: 'AVG',
				wet: '32016R0679'
			}
		);
		expect(a.groupKey).toBe('wet:32016r0679');
		expect(b.groupKey).toBe(a.groupKey);
		expect(geheel.groupKey).toBe(a.groupKey);
	});

	it('keys a judgment by itself, the rest by its group', () => {
		expect(bewaarItem(ro.id, { kort: ro.kort, at: ro.at }, { groep: ro.groep }).groupKey).toBe(
			ro.id
		);
		expect(bewaarItem('committees/x', { kort: 'x' }).groupKey).toBe('groep:Commissie');
	});

	it('keeps the readable address of a bron, so its link needs no redirect (#57)', () => {
		remember('/kamerstukken/34372/14', 'documents/093662ee');
		const i = bewaarItem('documents/093662ee', {
			kort: 'Kamerstukken II, 34372, nr. 14',
			at: 's-3'
		});
		expect(i.pad).toBe('/kamerstukken/34372/14');
		expect(itemHref(i)).toBe('/kamerstukken/34372/14#s-3');
		// An EU article seen in a list: its own address, not /explore?focus=.
		remember('/wetten/32022L2555/artikel/21', 'articles/32022l2555_21');
		const eu = bewaarItem('articles/32022l2555_21', { kort: 'art. 21', at: 'lid-2' });
		expect(itemHref(eu)).toBe('/wetten/32022L2555/artikel/21#lid-2');
		// Without the address it opens through the network.
		expect(itemHref(lid2)).not.toContain('#lid-2#');
	});

	it('moves an item among the items of its group by key, whatever its name', () => {
		const a = bewaarItem(stuk, { kort: 'a' }, { dossier: '36889' });
		const b = bewaarItem(
			'documents/b',
			{ kort: 'b' },
			{ groep: 'Kamerstukken 36889 X', dossier: '36889' }
		);
		const c = bewaarItem('members/c', { kort: 'c' });
		const uit = verschuif([a, c, b], itemKey(b), -1, 'groep');
		expect(uit.map((i) => i.kort)).toEqual(['b', 'c', 'a']);
	});
});

describe('a source outside Concordans', () => {
	const boek = externalItem({
		citation: '  Asser/Heerma van Voss & Van Slooten 7-V 2022/321 ',
		kind: 'book',
		url: 'https://example.org/asser'
	});

	it('is kept as the reader cites it, under Andere bronnen, its address its own', () => {
		expect(boek.id).toMatch(/^external:[a-z0-9]+$/);
		expect(isExternal(boek)).toBe(true);
		expect(boek).toMatchObject({
			at: '',
			kort: 'Asser/Heerma van Voss & Van Slooten 7-V 2022/321',
			groep: 'Andere bronnen',
			groupKey: 'groep:Andere bronnen',
			kind: 'book',
			url: 'https://example.org/asser'
		});
		expect(boek.pad).toBeUndefined();
		expect(isExternal(lid2)).toBe(false);
	});

	it('goes into a group of the map where the reader chooses one', () => {
		const noot = externalItem({
			citation: 'P.T. de Vries, noot bij HR 11 november 2005, JAR 2005/287',
			kind: 'annotation',
			group: { name: ro.groep, key: ro.groupKey }
		});
		expect(groepen([lid2, ro, noot]).map((g) => g.items.length)).toEqual([1, 2]);
		expect(noot.url).toBeUndefined();
	});

	it('takes only a web address', () => {
		expect(externalItem({ citation: 'x', kind: 'other', url: 'javascript:alert(1)' }).url).toBe(
			undefined
		);
		expect(externalItem({ citation: 'x', kind: 'other', url: 'geen adres' }).url).toBeUndefined();
	});

	it('is cited, exported, moved and read back as an item of Concordans', () => {
		expect(citaten([lid2, boek])).toContain('Andere bronnen\n2. Asser/Heerma van Voss');
		const regels = csv([lid2, boek], (i) => itemAddress(i, 'https://concordans.nl'));
		expect(regels).toContain('https://example.org/asser');
		expect(regels).toContain('https://concordans.nl/');
		expect(verschuif([lid2, boek], itemKey(boek), -1, 'eigen').map(itemKey)).toEqual([
			itemKey(boek),
			itemKey(lid2)
		]);
		expect(readItem(JSON.parse(JSON.stringify(boek)))).toEqual(boek);
		expect(readItem({ ...boek, kind: 'onzin', url: 'ftp://x' })).toEqual({
			...boek,
			kind: 'other',
			url: undefined
		});
		// Not a bron of the network.
		expect(netwerkIds([lid2, boek])).toEqual([lid2.id]);
	});
});

describe('the follow-ups of the UX test of 16 Oct', () => {
	it('numbers a name a bundel has already (#3)', () => {
		expect(freeName('Gemarkeerd', new Set(['Thuiswerk']))).toBe('Gemarkeerd');
		expect(freeName('Gemarkeerd', new Set(['Gemarkeerd']))).toBe('Gemarkeerd 2');
		expect(freeName('Gemarkeerd', new Set(['Gemarkeerd', 'Gemarkeerd 2']))).toBe('Gemarkeerd 3');
	});

	it('puts https:// before an address without its scheme (#5)', () => {
		expect(webAddress('voorbeeld.nl/boek')).toBe('https://voorbeeld.nl/boek');
		expect(webAddress('www.navigator.nl')).toBe('https://www.navigator.nl/');
		expect(webAddress('http://voorbeeld.nl/')).toBe('http://voorbeeld.nl/');
		expect(webAddress('geen adres')).toBeNull();
		expect(webAddress('javascript:alert(1)')).toBeNull();
	});

	it('writes the kind of each item in the CSV (#7)', () => {
		const boek = externalItem({ citation: 'Asser 7-V', kind: 'journal' });
		const [kop, eerste, tweede] = csv([lid2, boek], () => '')
			.slice(1)
			.split('\r\n');
		expect(kop.split(';')).toContain('soort');
		expect(eerste.split(';')).toContain('Artikel');
		expect(tweede.split(';')).toContain('Tijdschrift');
	});
});
