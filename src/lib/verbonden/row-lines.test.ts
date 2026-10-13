import { describe, expect, it } from 'vitest';
import { activityLine, citedLine, describe as beschrijf, historyRow, rolesLine } from './rows';
import { stemmingNaam } from '$lib/components/parliamentary/stemming';

describe('rolesLine', () => {
	it('names the role, a function other than Kamerlid and the stukken', () => {
		expect(
			rolesLine({
				roles: ['Eerste ondertekenaar', 'Mede ondertekenaar'],
				functions: ['minister van Financiën'],
				document_count: 6
			})
		).toBe('eerste ondertekenaar, als minister van Financiën, 6 stukken');
		expect(
			rolesLine({
				roles: ['Mede ondertekenaar'],
				functions: ['Tweede Kamerlid'],
				document_count: 1
			})
		).toBe('mede ondertekenaar, 1 stuk');
		expect(rolesLine({ roles: ['Mede ondertekenaar'], functions: ['Eerste Kamerlid'] })).toBe(
			'mede ondertekenaar, als Eerste Kamerlid'
		);
		expect(rolesLine({})).toBeNull();
	});
});

describe('citedLine', () => {
	it('names two articles and counts the rest', () => {
		expect(citedLine([])).toBeNull();
		expect(citedLine([{ article_number: '4:12' }])).toBe('art. 4:12');
		expect(
			citedLine([
				{ article_number: '4:12' },
				{ article_number: '5:49' },
				{ article_number: '5:50' }
			])
		).toBe('art. 4:12, 5:49 en 1 ander');
		expect(
			citedLine([
				{ article_number: '1' },
				{ article_number: '2' },
				{ article_number: '3' },
				{ article_number: null },
				{ article_number: '4' }
			])
		).toBe('art. 1, 2 en 2 andere');
	});
});

describe('activityLine', () => {
	it('names the kind, a status out of the ordinary and the dossiers', () => {
		expect(
			activityLine({ kind: 'Commissiedebat', status: 'Uitgevoerd', dossier_numbers: ['36600'] })
		).toBe('Commissiedebat, over Kamerstuk 36600');
		expect(
			activityLine({
				kind: 'Commissiedebat',
				status: 'Geannuleerd',
				dossier_numbers: ['22112', '21501-04']
			})
		).toBe('Commissiedebat, geannuleerd, over Kamerstuk 22112 en Kamerstuk 21501-04');
		expect(activityLine({})).toBeNull();
	});

	it('names a dossier by number and name where the API gives it (0.79.30)', () => {
		expect(
			activityLine({
				kind: 'Commissiedebat',
				dossier_numbers: ['36496'],
				dossiers: [{ number: '36496', short_title: 'Wet betaalbare huur', title: null }]
			})
		).toBe('Commissiedebat, over Kamerstuk 36496 Wet betaalbare huur');
		expect(stemmingNaam(null, { number: '29665', title: 'Evaluatie Schipholbeleid' })).toBe(
			'Stemming over Kamerstuk 29665 Evaluatie Schipholbeleid'
		);
		expect(stemmingNaam(null, '36496')).toBe('Stemming over Kamerstuk 36496');
		const brief = beschrijf('documents', 'b', null, {
			kind: 'Brief regering',
			title: 'Kabinetsreactie op het advies',
			dossier_number: '36496',
			sequence: 12,
			dossier_short_title: 'Wet betaalbare huur'
		});
		expect(brief.context).toBe('Brief regering, Kamerstuk 36496, nr. 12, Wet betaalbare huur');
	});
});

describe('historyRow', () => {
	it('titles a change by its dossier and says what it does', () => {
		const row = historyRow({
			dossier_number: '34588',
			dossier_title: 'Wet op de inlichtingen- en veiligheidsdiensten 2017',
			date: '2017-08-17',
			change: 'amends',
			status: 'canoniek',
			summary: 'Stb. 2017, 317',
			document_id: 'instruments/stb_2017_317'
		});
		expect(row?.ref).toEqual({ collection: 'instruments', key: 'stb_2017_317' });
		expect(row?.title).toBe('Wet op de inlichtingen- en veiligheidsdiensten 2017');
		expect(row?.identifier).toBe('Stb. 2017, 317');
		expect(row?.context).toBe('wijzigt, Kamerstuk 34588');
		expect(row?.proposed).toBe(false);
		expect(row?.relation).toBe('AMENDS');
	});

	it('marks a proposed change and falls back on the dossier', () => {
		const row = historyRow({ dossier_number: '36000', change: 'repeals', status: 'voorgesteld' });
		expect(row?.ref).toEqual({ collection: 'dossiers', key: '36000', number: '36000' });
		expect(row?.proposed).toBe(true);
		expect(row?.context).toBe('voorgesteld, doet vervallen, Kamerstuk 36000');
		expect(historyRow({})).toBeNull();
	});
});
