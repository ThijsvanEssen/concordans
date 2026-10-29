import { describe, expect, it } from 'vitest';
import { parseNetwerk } from '$lib/selection/netwerk';
import {
	bewaarDossier,
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
	groupKeyOf,
	placeRows,
	rowTitle,
	JUDGMENTS_GROUP,
	readAnnotation,
	readAnnotations,
	withoutItem,
	type Annotation,
	type MapItem
} from './map';
import {
	citePaper,
	paperParagraphCite,
	paperSectionCite
} from '$lib/components/parliamentary/paper-cite';
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
			['Rechtspraak', 1]
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
			'Burgerlijk Wetboek Boek 6\n1. artikel 6:162 lid 2 Burgerlijk Wetboek\n\nRechtspraak\n2. HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1'
		);
	});

	it('cites with the link and the day consulted', () => {
		const attribution = {
			address: (i: MapItem) => `https://concordans.nl/${i.id}`,
			consulted: '2026-10-22'
		};
		expect(citaten([ro], 'groep', null, null, attribution)).toBe(
			'Rechtspraak\n1. HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1 (https://concordans.nl/' +
				`${ro.id}, geraadpleegd 22\u00a0oktober\u00a02026)`
		);
		// A source without an address keeps the day.
		expect(citaten([ro], 'eigen', null, null, { address: () => '', consulted: '2026-10-22' })).toBe(
			'1. HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1 (geraadpleegd 22\u00a0oktober\u00a02026)'
		);
	});

	it('adds the day consulted to the CSV', () => {
		const t = csv([ro], () => '/x', 'groep', '2026-10-22');
		expect(t).toContain(';adres;geraadpleegd\r\n');
		expect(t.trimEnd().endsWith(';/x;2026-10-22')).toBe(true);
	});

	it('writes a CSV as Excel reads it', () => {
		const t = csv([ro], (i) => `/x#${i.at}`);
		expect(t.startsWith('﻿volgorde;groep;soort;citaat;vindplaats;aantekening;adres\r\n')).toBe(
			true
		);
		expect(t).toContain(';Rechtspraak;');
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
			'3;Rechtspraak;Uitspraak;HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1;r.o. 5.7.1;;'
		]);
		// In the reader's own order: that order, each under its group's name.
		expect(regels(csv([lid2, ro, lid3a], adres, 'eigen')).map((r) => r.split(';')[1])).toEqual([
			'Burgerlijk Wetboek Boek 6',
			'Rechtspraak',
			'Burgerlijk Wetboek Boek 6'
		]);
		// A place the reader cannot print stays out.
		expect(regels(csv([{ ...lid2, at: 'p-54bd15c1' }], adres))[0]).toBe(
			'1;Burgerlijk Wetboek Boek 6;Artikel;artikel 6:162 lid 2 Burgerlijk Wetboek;;;'
		);
	});

	it('writes the place of a kept alinea, passage or overweging as its menu cites it', () => {
		const paper = citePaper(
			{ key: 'mvt', kind: 'Memorie van toelichting', chamber: 'TK', number: '60' },
			{ session_year: '2025-2026', dossier_number: '37020', dossier_suffix: 'XVI' }
		);
		const alinea = paperParagraphCite(paper)(3, 'p-54bd15c1', '').bewaar;
		const passage = paperSectionCite(paper)({ id: 's-3f2a9c1e', heading: 'Artikel 21' }, '').bewaar;
		const overweging = bewaarItem('judgments/ecli_nl_hr_2019_2006', {
			at: 'p-0a1b2c3d',
			kort: 'HR 20 december 2019, r.o. 5.3.2.1'
		});
		const places = (t: string) =>
			t
				.slice(1)
				.split('\r\n')
				.slice(1)
				.map((r) => r.split(';')[4]);
		expect(alinea.kort).toMatch(/, alinea 3$/);
		expect(places(csv([alinea, passage, overweging], () => ''))).toEqual([
			'alinea 3',
			'§ Artikel 21',
			'r.o. 5.3.2.1'
		]);
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
		expect(href).toBe('/explore?netwerk=articles/bwbr0005289_162,judgments/ecli_nl_hr_2019_2006');
		// As the Verkenner reads it: these bronnen on, none between them.
		const n = parseNetwerk(new URL(href, 'https://concordans.nl').searchParams);
		expect(n.ids).toEqual([lid2.id, ro.id]);
		expect(n.uit.size).toBe(0);
		expect(netwerkHref([])).toBeNull();
	});

	it("puts a group's note under its name in the citations", () => {
		expect(citaten([lid2, ro], 'groep', null, { 'wet:bwbr0005289': 'Waarom deze wet' })).toBe(
			'Burgerlijk Wetboek Boek 6\nWaarom deze wet\n1. artikel 6:162 lid 2 Burgerlijk Wetboek\n\nRechtspraak\n2. HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1'
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
			filterGroup: 'stukken',
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

describe('the judgments of a bundel, one group Rechtspraak (decision 20A)', () => {
	const hr = {
		...ro,
		at: '',
		kort: 'HR 20 december 2019',
		voluit: 'HR 20 december 2019, ECLI:NL:HR:2019:2006'
	};
	const ro2 = { ...ro, at: 'rov-2.1', kort: 'HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 2.1' };
	const other: MapItem = {
		id: 'judgments/ecli_nl_rbdha_2015_7196',
		at: 'rov-4.1',
		kort: 'Rb. Den Haag 24 juni 2015, ECLI:NL:RBDHA:2015:7196, r.o. 4.1',
		groep: 'Rb. Den Haag 24 juni 2015 (Urgenda)',
		groupKey: 'judgments/ecli_nl_rbdha_2015_7196'
	};

	it('puts every judgment in one group, whatever key it was kept under', () => {
		expect(groupKeyOf(ro)).toBe(JUDGMENTS_GROUP);
		expect(groupKeyOf(lid2)).toBe('wet:bwbr0005289');
		expect(groepen([ro, lid2, other]).map((g) => [g.sleutel, g.groep, g.items.length])).toEqual([
			[JUDGMENTS_GROUP, 'Rechtspraak', 2],
			['wet:bwbr0005289', 'Burgerlijk Wetboek Boek 6', 1]
		]);
	});

	it('shows the r.o.’s of one judgment as places under it, the judgment once', () => {
		const rows = placeRows([ro, other, hr, ro2]);
		expect(rows.map((r) => [r.head.kort, r.kept, r.places.map((p) => p.at)])).toEqual([
			['HR 20 december 2019', true, ['rov-5.7.1', 'rov-2.1']],
			['Rb. Den Haag 24 juni 2015, ECLI:NL:RBDHA:2015:7196, r.o. 4.1', true, []]
		]);
		// Two r.o.'s without the judgment itself: the judgment heads them, not kept.
		const [only] = placeRows([ro, ro2]);
		expect(only.kept).toBe(false);
		expect(only.head).toMatchObject({ id: ro.id, at: '', notitie: null });
		expect(only.head.kort).toBe('HR 20 december 2019, ECLI:NL:HR:2019:2006');
		expect(only.places).toEqual([ro, ro2]);
	});

	it('moves and exports a judgment within Rechtspraak', () => {
		expect(verschuif([ro, lid2, other], itemKey(other), -1, 'groep')).toEqual([other, lid2, ro]);
		expect(csv([ro, lid2], () => '').split('\r\n')[1]).toContain('Rechtspraak');
	});
});

describe('the alineas of a Kamerstuk in a bundel, under the stuk (A28)', () => {
	const stuk: MapItem = {
		id: 'documents/0c0aab25',
		at: '',
		kort: 'Kamerstukken II 2025/26, 37020 XVI, nr. 57',
		voluit: 'Kamerstukken II 2025/26, 37020 XVI, nr. 57 (Motie)',
		groep: 'Kamerstuk 37020 XVI',
		groupKey: 'dossier:37020-XVI'
	};
	const al = (n: number): MapItem => ({
		...stuk,
		at: `p-${String(n).padStart(8, '0')}`,
		kort: `${stuk.kort}, alinea ${n}`,
		voluit: `${stuk.voluit}, alinea ${n}`
	});

	it('shows two alineas under their stuk, the stuk heading them without being kept', () => {
		const [rij, ander] = placeRows([al(4), lid2, al(6)]);
		expect(rij.kept).toBe(false);
		expect(rij.head).toMatchObject({ id: stuk.id, at: '', kort: stuk.kort, voluit: null });
		expect(rij.places.map((p) => p.at)).toEqual(['p-00000004', 'p-00000006']);
		expect(ander).toEqual({ head: lid2, kept: true, places: [] });
		expect(rowTitle(al(4), true)).toEqual({ title: 'alinea 4' });
		// A passage (a section of the memorie) under its stuk, by its heading.
		const passage = {
			...stuk,
			at: 's-300',
			kort: `${stuk.kort}, § Artikel X, onderdeel A`,
			voluit: null
		};
		expect(rowTitle(passage, true)).toEqual({ title: '§ Artikel X, onderdeel A' });
		expect(placeRows([passage, al(4)])[0].head.kort).toBe(stuk.kort);
	});

	it('shows one alinea alone as the stuk’s row, and the alineas under a stuk kept itself', () => {
		expect(placeRows([al(4)])).toEqual([{ head: al(4), kept: true, places: [] }]);
		expect(placeRows([al(4), stuk])).toEqual([{ head: stuk, kept: true, places: [al(4)] }]);
	});

	it('keeps two leden of one article as rows of their own', () => {
		const lid1 = { ...lid2, at: 'lid-1', kort: 'art. 6:162 lid 1 BW' };
		expect(placeRows([lid1, lid2]).map((r) => r.head)).toEqual([lid1, lid2]);
	});
});

describe('the citation of a row: one line (bundels-ux 2b.6)', () => {
	it('never puts the full form under the short one: one line, the full form where it adds an ECLI (A53 #6)', () => {
		const rb = {
			id: 'judgments/ecli_nl_rbdha_2015_7196',
			at: '',
			kort: 'Rb. Den Haag 24 juni 2015 (Urgenda)',
			voluit: 'Rb. Den Haag 24 juni 2015, ECLI:NL:RBDHA:2015:7196'
		};
		expect(rowTitle(rb)).toEqual({ title: rb.voluit });
		const passage = {
			id: 'documents/8c1a3474',
			at: 's-300',
			kort: 'Kamerstukken II 2025/26, 36812, nr. 3, § Artikel X',
			voluit: 'Kamerstukken II 2025/26, 36812, nr. 3 (Memorie van toelichting), § Artikel X'
		};
		expect(rowTitle(passage)).toEqual({ title: passage.kort });
	});

	it('leaves out the full form where it only writes out the short one', () => {
		expect(rowTitle(lid2)).toEqual({ title: 'art. 6:162 lid 2 BW' });
	});

	it('takes the full form where it adds to the short one', () => {
		const hr = {
			...ro,
			at: '',
			kort: 'HR 20 december 2019',
			voluit: 'HR 20 december 2019, ECLI:NL:HR:2019:2006'
		};
		expect(rowTitle(hr)).toEqual({ title: 'HR 20 december 2019, ECLI:NL:HR:2019:2006' });
		expect(rowTitle({ ...ro })).toEqual({ title: ro.kort });
		const dossier: MapItem = {
			id: 'dossiers/36327',
			at: '',
			kort: 'Kamerstukken 36327',
			voluit: 'Wetboek van Strafvordering',
			groep: 'Kamerstukken 36327',
			groupKey: 'dossier:36327'
		};
		// Its group names it: the row cites it by its number, the title not twice (A14 #6).
		expect(rowTitle(dossier)).toEqual({ title: 'Kamerstuk 36327' });
		expect(
			rowTitle({ ...dossier, kort: 'Kamerstukken 36600 VII (Begroting BZK 2025)', voluit: null })
		).toEqual({ title: 'Kamerstuk 36600 VII' });
	});

	it('names a place under its judgment by the place alone', () => {
		expect(rowTitle(ro, true)).toEqual({ title: 'r.o. 5.7.1' });
	});
});

describe('a dossier kept', () => {
	// The API addresses a dossier by its number; its node key (36600_vii) is no number (422).
	const d = { key: '36600_vii', number: '36600-VII', title: 'Begroting BZK', short_title: null };

	it('is named by its number, as a link names it', () => {
		const item = bewaarDossier(d);
		expect(item.id).toBe('dossiers/36600-VII');
		expect(item.kort).toBe('Kamerstukken 36600 VII');
		expect(item.groupKey).toBe('dossier:36600-VII');
	});

	it('goes into the network by its number', () => {
		expect(netwerkIds([bewaarDossier(d)])).toEqual(['dossiers/36600-VII']);
	});
});

describe('an item read back (onderzoeksflow stap 1–2)', () => {
	it('keeps a field of a later version as it was kept, and drops a known one that does not read', () => {
		const later = { ...lid2, toekomst: { a: [1, 2] }, pad: '//elders' };
		const { pad: _pad, ...zonderPad } = later;
		expect(readItem(later)).toEqual(zonderPad);
	});

	it('keeps the day of the text kept, a day only', () => {
		const kort = { kort: 'art. 6:162 BW' };
		expect(bewaarItem(lid2.id, kort, { versie: '2024-01-01' }).versie).toBe('2024-01-01');
		expect(bewaarItem(lid2.id, kort, { versie: null })).not.toHaveProperty('versie');
		expect(readItem({ ...lid2, versie: '2024-01-01' })?.versie).toBe('2024-01-01');
		expect(readItem({ ...lid2, versie: 'gisteren' })).not.toHaveProperty('versie');
	});
});

describe('an aantekening (onderzoeksflow stap 3)', () => {
	const keys = new Set([itemKey(lid2), itemKey(ro)]);
	const fragment = { waar: 'lid-2', exact: 'onrechtmatige daad', suffix: ' jegens', start: 9 };
	const arcering: Annotation = { id: 'a-12ab34cd', op: itemKey(lid2), fragment, tekst: 'Kern' };
	const koppeling: Annotation = {
		id: 'a-56ef78gh',
		op: itemKey(lid2),
		fragment,
		bron: itemKey(ro),
		bronFragment: { waar: 'rov-5.7.1', exact: 'zorgplicht', start: 0 }
	};

	it('reads back as it was written, with a field of a later version', () => {
		expect(readAnnotation(JSON.parse(JSON.stringify(arcering)), keys)).toEqual(arcering);
		expect(readAnnotation(koppeling, keys)).toEqual(koppeling);
		const later = { ...arcering, toekomst: 1, fragment: { ...fragment, toekomst: 2 } };
		expect(readAnnotation(later, keys)).toEqual(later);
		expect(readAnnotation({ ...arcering, tegen: '2020-01-01' }, keys)?.tegen).toBe('2020-01-01');
	});

	it('does not read on no item of the bundel, towards none, or with a fragment without words', () => {
		const onleesbaar = [
			{ ...arcering, op: 'articles/bwbr0000000_1' },
			{ ...koppeling, bron: 'articles/bwbr0000000_1' },
			{ ...arcering, fragment: { ...fragment, exact: '' } },
			{ ...arcering, fragment: { ...fragment, start: -1 } },
			{ ...arcering, fragment: 'lid-2' },
			{ ...arcering, id: 'x' },
			{ ...arcering, bron: undefined, bronFragment: fragment },
			null,
			'a-12ab34cd'
		];
		for (const a of onleesbaar) expect(readAnnotation(a, keys)).toBeNull();
		expect(readAnnotations([arcering, ...onleesbaar], [lid2, ro])).toEqual({
			aantekeningen: [arcering],
			rest: onleesbaar
		});
		expect(readAnnotations(undefined, [lid2])).toEqual({ aantekeningen: [], rest: [] });
	});

	it('goes with its item out of the bundel; one towards it stays on its own item', () => {
		const leeg: Annotation = { id: 'a-00000000', op: itemKey(lid2), bron: itemKey(ro) };
		expect(withoutItem([arcering, koppeling, leeg], itemKey(lid2))).toEqual([]);
		const { bron: _b, bronFragment: _f, ...zonderBron } = koppeling;
		expect(withoutItem([arcering, koppeling, leeg], itemKey(ro))).toEqual([arcering, zonderBron]);
	});
});
