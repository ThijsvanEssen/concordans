import { describe, expect, it, vi } from 'vitest';
import { parseNetwerk } from '$lib/netwerk/netwerk';
import {
	bewaarItem,
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
import { itemVanRij } from './rij';
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

	it('goes into a link and comes back the same, whatever its words hold', () => {
		const terug = uitParam(naarParam([lid2, ro]));
		expect(terug).toEqual([
			{ id: lid2.id, at: lid2.at, kort: lid2.kort, groep: lid2.groep, groupKey: lid2.groupKey },
			{ id: ro.id, at: ro.at, kort: ro.kort, groep: ro.groep, groupKey: ro.groupKey }
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
			notitie: m.notitie,
			groepNotities: {}
		});
		// A link of before: no note, no order.
		const oud = new URLSearchParams({ map: naarParam([lid2]), mapnaam: 'Oud' });
		expect(uitParams(oud)).toEqual({
			naam: 'Oud',
			items: uitParam(naarParam([lid2])),
			volgorde: 'groep',
			notitie: null,
			groepNotities: {}
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

	it('carries the notes per group in the address, only of groups the map holds', () => {
		const groepNotities = {
			'wet:bwbr0005289': 'De onrechtmatige daad; ~ en ; erin',
			[ro.id]: 'Urgenda',
			'wet:bwbr0000000': 'weg'
		};
		const p = mapParams({ naam: 'M', items: [lid2, ro], volgorde: 'groep', groepNotities });
		const terug = uitParams(new URLSearchParams(p.toString()))!;
		expect(terug.groepNotities).toEqual({
			'wet:bwbr0005289': 'De onrechtmatige daad; ~ en ; erin',
			[ro.id]: 'Urgenda'
		});
		expect(mapParams({ naam: 'M', items: [lid2], volgorde: 'groep' }).has('mapgroepen')).toBe(
			false
		);
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
			kind: 'toelichtingen',
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

	it('carries the group key in the address', () => {
		const i = bewaarItem(stuk, { kort: 'MvT' }, { dossier: '36889' });
		expect(uitParam(naarParam([i]))).toEqual([i]);
	});

	it('leaves out an item of an old or broken link or store, and says so', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		// A link of before 14 Oct: five fields, no group key.
		expect(uitParam(`${stuk}~~MvT~Kamerstukken 36889~een notitie`)).toEqual([]);
		expect(uitParams(new URLSearchParams({ map: `${stuk}~~MvT~Kamerstukken 36889` }))).toBeNull();
		const heel = naarParam([lid2]);
		expect(uitParam(`${heel};${stuk}~~MvT`)).toEqual([{ ...lid2, voluit: undefined }]);
		expect(warn).toHaveBeenCalledTimes(3);
		warn.mockRestore();
	});

	it('moves an item among the items of its group by key, whatever its name', () => {
		const a = bewaarItem(stuk, { kort: 'a' }, { dossier: '36889' });
		const b = bewaarItem(
			'documents/b',
			{ kort: 'b' },
			{ groep: 'Kamerstukken 36889 X', dossier: '36889' }
		);
		const c = bewaarItem('members/c', { kort: 'c' });
		const uit = verschuif([a, c, b], sleutelVan(b), -1, 'groep');
		expect(uit.map((i) => i.kort)).toEqual(['b', 'c', 'a']);
	});
});
