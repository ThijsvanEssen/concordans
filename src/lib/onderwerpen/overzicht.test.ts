import { describe, expect, it } from 'vitest';
import {
	filter,
	naarCsv,
	opOnderwerp,
	perJaar,
	perSoort,
	totaal,
	type Besluit,
	type Stem
} from './overzicht';

const b = (
	key: string,
	date: string,
	kind: string | null,
	passed: boolean | null,
	subject = ''
): Besluit => ({
	id: `decisions/${key}`,
	key,
	date,
	kind,
	passed,
	subject,
	chamber: 'TK',
	decision_kind: passed === null ? 'Stemmen - uitstellen' : 'Stemmen - aangenomen',
	dossier_numbers: ['35334'],
	tally: { Voor: 80, Tegen: 70 }
});

const lijst = [
	b('a', '2026-07-02', 'Motie', true, 'Motie over stikstof'),
	b('b', '2026-06-01', 'Motie', false),
	b('c', '2024-03-01', 'Amendement', true),
	b('d', '2024-01-01', null, null)
];
const stemmen = new Map<string, Stem>([
	['a', 'voor'],
	['b', 'tegen']
]);

describe('overzicht', () => {
	it('telt per soort, met de stem van een fractie', () => {
		expect(perSoort(lijst, stemmen)[0]).toEqual([
			'Motie',
			{ totaal: 2, aangenomen: 1, verworpen: 1, overig: 0, voor: 1, tegen: 1 }
		]);
		expect(perSoort(lijst, stemmen).map(([k]) => k)).toContain('Overig');
		expect(totaal(lijst, stemmen).totaal).toBe(4);
	});

	it('telt per jaar, ook een jaar zonder besluiten ertussen', () => {
		expect(perJaar(lijst, stemmen).map(([j, t]) => [j, t.totaal])).toEqual([
			['2026', 2],
			['2025', 0],
			['2024', 2]
		]);
	});

	it('een getal en zijn lijst zijn even lang', () => {
		const [, motie] = perSoort(lijst, stemmen)[0];
		expect(filter(lijst, { soort: 'Motie', uitkomst: 'verworpen' }, stemmen)).toHaveLength(
			motie.verworpen
		);
		expect(filter(lijst, { stem: 'voor' }, stemmen).map((d) => d.key)).toEqual(['a']);
		expect(filter(lijst, { jaar: '2024' }, stemmen)).toHaveLength(2);
	});

	it('een woord moet als woord in de titel staan', () => {
		expect(opOnderwerp({ subject: 'Motie over stikstof' }, ['PFAS', 'stikstof'])).toBe(true);
		expect(opOnderwerp({ subject: 'Motie over universitaire aanstelling' }, ['AI'])).toBe(false);
	});

	it('de CSV leest in Excel met Nederlandse instellingen', () => {
		const csv = naarCsv(lijst.slice(0, 1), 'https://concordans.nl', 'VVD', stemmen);
		expect(csv.startsWith('﻿')).toBe(true);
		const [kop, rij] = csv.slice(1).split('\r\n');
		expect(kop.split(';')).toContain('stem VVD');
		expect(rij).toContain('2026-07-02;TK;Motie;Motie over stikstof;35334;aangenomen');
		expect(rij).toContain(';voor;https://concordans.nl/');
	});
});
