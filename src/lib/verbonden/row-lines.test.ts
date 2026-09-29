import { describe, expect, it } from 'vitest';
import { activityLine, citedLine, historyRow, rolesLine } from './rows';

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
		).toBe('Commissiedebat, over 36600');
		expect(
			activityLine({
				kind: 'Commissiedebat',
				status: 'Geannuleerd',
				dossier_numbers: ['22112', '21501-04']
			})
		).toBe('Commissiedebat, geannuleerd, over 22112 en 21501-04');
		expect(activityLine({})).toBeNull();
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
		expect(row?.context).toBe('wijzigt, dossier 34588');
		expect(row?.proposed).toBe(false);
		expect(row?.relation).toBe('AMENDS');
	});

	it('marks a proposed change and falls back on the dossier', () => {
		const row = historyRow({ dossier_number: '36000', change: 'repeals', status: 'voorgesteld' });
		expect(row?.ref).toEqual({ collection: 'dossiers', key: '36000', number: '36000' });
		expect(row?.proposed).toBe(true);
		expect(row?.context).toBe('voorgesteld, trekt in, dossier 36000');
		expect(historyRow({})).toBeNull();
	});
});
