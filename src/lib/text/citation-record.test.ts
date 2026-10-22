import { describe, expect, it } from 'vitest';
import { articleTitle, citationRecord } from './citation-record';
import { BW_BOOKS } from './bw';

describe('citationRecord', () => {
	it('heads an article with the abbreviation of its law and cites it short (E6)', () => {
		const r = citationRecord({
			kind: 'article',
			bwbId: BW_BOOKS['6'],
			articleNumber: '162',
			shortTitle: 'Boek 6 BW',
			citationTitle: 'Burgerlijk Wetboek Boek 6'
		});
		expect(r.heading).toBe('Artikel 6:162 BW');
		expect(r.short).toBe('art. 6:162 BW');
		expect(r.full).toBe('artikel 6:162 van het Burgerlijk Wetboek');
		const avg = citationRecord({
			kind: 'article',
			articleNumber: '6',
			shortTitle: 'AVG',
			citationTitle: 'Verordening (EU) 2016/679'
		});
		expect([avg.heading, avg.short]).toEqual(['Artikel 6 AVG', 'art. 6 AVG']);
	});

	it('heads an article of a law without an abbreviation by its number, the law above it', () => {
		const r = citationRecord({
			kind: 'article',
			articleNumber: '3',
			shortTitle: null,
			citationTitle: 'Regeling voorzieningenplanning vo 2018'
		});
		expect(r.heading).toBe('Artikel 3');
		expect(r.short).toBe('art. 3 Regeling voorzieningenplanning vo 2018');
		expect(
			citationRecord({
				kind: 'article',
				articleNumber: 'enig-artikel',
				label: 'Enig artikel',
				shortTitle: 'Wbni',
				citationTitle: 'Wet beveiliging netwerk- en informatiesystemen'
			}).heading
		).toBe('Enig artikel');
	});

	it('heads a law by its name and abbreviation, an act of the EU by the name it goes by', () => {
		const wbni = citationRecord({
			kind: 'law',
			bwbId: 'BWBR0041515',
			citationTitle: 'Wet beveiliging netwerk- en informatiesystemen',
			abbreviation: 'Wbni',
			shortTitle: 'Wbni'
		});
		expect(wbni.heading).toBe('Wet beveiliging netwerk- en informatiesystemen (Wbni)');
		expect(wbni.short).toBe(wbni.heading);
		const avg = citationRecord({
			kind: 'law',
			citationTitle: 'Verordening (EU) 2016/679',
			abbreviation: 'AVG',
			shortTitle: 'Algemene verordening gegevensbescherming',
			fullTitle: 'Verordening (EU) 2016/679 van het Europees Parlement en de Raad …'
		});
		expect(avg.heading).toBe('Algemene verordening gegevensbescherming (AVG)');
		expect(avg.short).toBe('Verordening (EU) 2016/679 (AVG)');
		expect(avg.full).toBe('Verordening (EU) 2016/679 van het Europees Parlement en de Raad …');
		const bw = citationRecord({
			kind: 'law',
			bwbId: BW_BOOKS['6'],
			citationTitle: 'Burgerlijk Wetboek Boek 6',
			abbreviation: 'BW6'
		});
		expect([bw.heading, bw.place]).toEqual(['Burgerlijk Wetboek Boek 6', 'Boek 6 BW']);
	});

	it('cites a Kamerstuk as Kamerstukken II or I with its vergaderjaar everywhere', () => {
		const motie = citationRecord({
			kind: 'kamerstuk',
			paperKind: 'Motie',
			date: '2024-04-17',
			dossier_number: '36306',
			number: '11'
		});
		expect(motie?.short).toBe('Kamerstukken II 2023/24, 36306, nr. 11');
		expect(motie?.heading).toBe(motie?.short);
		expect(motie?.full).toBe('Kamerstukken II 2023/24, 36306, nr. 11 (Motie)');
		expect(motie?.place).toBe('36306, nr. 11');
		expect(
			citationRecord({
				kind: 'kamerstuk',
				chamber: 'EK',
				session_year: '2009-2010',
				dossier_number: '32217',
				number: 'A'
			})?.short
		).toBe('Kamerstukken I 2009/10, 32217, A');
		expect(
			citationRecord({
				kind: 'kamerstuk',
				date: '2026-03-03',
				dossier_number: '36764',
				numbers: ['3', '4', '5']
			})?.short
		).toBe('Kamerstukken II 2025/26, 36764, nrs. 3–5');
		expect(citationRecord({ kind: 'kamerstuk', dossier_number: null, number: '3' })).toBeNull();
	});

	it('heads a Staatsblad with the law it enacted and its abbreviation', () => {
		const stb = citationRecord({
			kind: 'publication',
			series: 'Stb',
			year: 2018,
			number: '387',
			law: { title: 'Wet beveiliging netwerk- en informatiesystemen', abbreviation: 'Wbni' }
		});
		expect(stb?.heading).toBe(
			'Wet beveiliging netwerk- en informatiesystemen (Wbni), Stb. 2018, 387'
		);
		expect(stb?.short).toBe('Stb. 2018, 387');
		expect(
			citationRecord({ kind: 'publication', series: 'stb', year: '2026', number: 94 })?.heading
		).toBe('Stb. 2026, 94');
		expect(citationRecord({ kind: 'publication', series: null, year: 2026, number: 1 })).toBeNull();
	});

	it('cites a dossier and a judgment', () => {
		const d = citationRecord({ kind: 'dossier', number: '36600-VIII', name: 'Begroting OCW' });
		expect([d.short, d.full]).toEqual([
			'Kamerstukken 36600 VIII',
			'Kamerstukken 36600 VIII (Begroting OCW)'
		]);
		const cite = {
			short: 'HR 20 december 2019',
			full: 'HR 20 december 2019, ECLI:NL:HR:2019:2006'
		};
		expect(citationRecord({ kind: 'judgment', cite })).toMatchObject({
			heading: cite.short,
			short: cite.short,
			full: cite.full
		});
		expect(citationRecord({ kind: 'judgment', cite: null })).toBeNull();
	});
});

describe('articleTitle', () => {
	it('names an article by the abbreviation of its law', () => {
		const evrm = { instrument_abbreviation: 'EVRM', article_number: '8' };
		expect(articleTitle('Artikel 8 Verdrag tot bescherming van de rechten van de mens', evrm)).toBe(
			'Artikel 8 EVRM'
		);
		expect(
			articleTitle('Artikel 3:4 Algemene wet bestuursrecht', {
				instrument_abbreviation: 'Awb',
				article_number: '3:4'
			})
		).toBe('Artikel 3:4 Awb');
	});

	it('keeps the book of a BW article and the name where there is no abbreviation', () => {
		expect(
			articleTitle('Artikel 162 Burgerlijk Wetboek Boek 6', {
				instrument_abbreviation: 'BW6',
				article_number: '162'
			})
		).toBe('Artikel 6:162 BW');
		expect(articleTitle('Artikel 1 Wet X', { article_number: '1' })).toBe('Artikel 1 Wet X');
	});
});
