import { describe, expect, it } from 'vitest';
import { parseNetwerk } from '$lib/netwerk/netwerk';
import {
	citaten,
	csv,
	groepen,
	mapParams,
	naarParam,
	netwerkHref,
	netwerkIds,
	samen,
	sleutelVan,
	uitParam,
	uitParams,
	verschuif,
	type MapItem
} from './map';

const lid2: MapItem = {
	id: 'articles/bwbr0005289_162',
	at: 'lid-2',
	kort: 'art. 6:162 lid 2 BW',
	voluit: 'artikel 6:162 lid 2 Burgerlijk Wetboek',
	groep: 'Burgerlijk Wetboek Boek 6'
};
const ro: MapItem = {
	id: 'judgments/ecli_nl_hr_2019_2006',
	at: 'rov-5.7.1',
	kort: 'HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1',
	groep: 'HR 20 december 2019 (Urgenda); a~b'
};

describe('the map', () => {
	it('keys an item by its bron and its place', () => {
		expect(sleutelVan(lid2)).toBe('articles/bwbr0005289_162#lid-2');
		expect(sleutelVan({ id: 'documents/x', at: '' })).toBe('documents/x');
	});

	it('groups in the order things were kept', () => {
		const lid3 = { ...lid2, at: 'lid-3', kort: 'art. 6:162 lid 3 BW' };
		expect(groepen([lid2, ro, lid3]).map((g) => [g.groep, g.items.length])).toEqual([
			['Burgerlijk Wetboek Boek 6', 2],
			['HR 20 december 2019 (Urgenda); a~b', 1]
		]);
	});

	it('goes into a link and comes back the same, whatever its words hold', () => {
		const terug = uitParam(naarParam([lid2, ro]));
		expect(terug).toEqual([
			{ id: lid2.id, at: lid2.at, kort: lid2.kort, groep: lid2.groep },
			{ id: ro.id, at: ro.at, kort: ro.kort, groep: ro.groep }
		]);
		expect(uitParam('nonsense~~')).toEqual([]);
		expect(uitParam(null)).toEqual([]);
	});

	it('adds a shared map to its own without doubles', () => {
		expect(samen([lid2], [lid2, ro]).map(sleutelVan)).toEqual([sleutelVan(lid2), sleutelVan(ro)]);
	});

	it('cites per group, numbered, the full form where there is one', () => {
		expect(citaten([lid2, ro])).toBe(
			'Burgerlijk Wetboek Boek 6\n1. artikel 6:162 lid 2 Burgerlijk Wetboek\n\nHR 20 december 2019 (Urgenda); a~b\n2. HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1'
		);
	});

	it('writes a CSV as Excel reads it', () => {
		const t = csv([ro], (i) => `/x#${i.at}`);
		expect(t.startsWith('﻿volgorde;groep;citaat;vindplaats;aantekening;adres\r\n')).toBe(true);
		expect(t).toContain('"HR 20 december 2019 (Urgenda); a~b"');
	});

	it('carries a note in the link, the citations and the CSV', () => {
		const met = { ...lid2, notitie: 'Drie categorieën; ~ en ; erin' };
		expect(uitParam(naarParam([met]))[0].notitie).toBe(met.notitie);
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
		expect(verschuif(lijst, sleutelVan(lid3), -1, 'groep').map((i) => i.at)).toEqual([
			'lid-3',
			'rov-5.7.1',
			'lid-2'
		]);
		expect(verschuif(lijst, sleutelVan(lid3), -1, 'eigen').map((i) => i.at)).toEqual([
			'lid-2',
			'lid-3',
			'rov-5.7.1'
		]);
		expect(verschuif(lijst, sleutelVan(lid2), -1, 'eigen')).toEqual(lijst);
	});

	it('carries the note of the map in its address, and reads one without it as before', () => {
		const m = {
			naam: 'Cyberbeveiligingswet',
			items: [lid2, ro],
			volgorde: 'eigen' as const,
			notitie: 'Zorgplicht en training; ~ en ; erin\nTweede regel'
		};
		const terug = uitParams(new URLSearchParams(mapParams(m).toString()));
		expect(terug).toEqual({
			naam: m.naam,
			items: uitParam(naarParam(m.items)),
			volgorde: 'eigen',
			notitie: m.notitie
		});
		// A link of before: no note, no order.
		const oud = new URLSearchParams({ map: naarParam([lid2]), mapnaam: 'Oud' });
		expect(uitParams(oud)).toEqual({
			naam: 'Oud',
			items: uitParam(naarParam([lid2])),
			volgorde: 'groep',
			notitie: null
		});
		expect(mapParams({ ...m, volgorde: 'groep', notitie: '  ' }).has('mapnotitie')).toBe(false);
		expect(uitParams(new URLSearchParams('mapnotitie=x'))).toBeNull();
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
});
