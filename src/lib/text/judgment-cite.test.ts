import { describe, expect, it } from 'vitest';
import {
	authorCite,
	conclusieNaam,
	courtCite,
	isConclusion,
	judgmentCite,
	overwegingCitaat,
	paragraphCite
} from './judgment-cite';

describe('judgmentCite', () => {
	it('cites the Hoge Raad as lawyers do', () => {
		expect(judgmentCite('ECLI:NL:HR:2019:1278', '2019-07-19', 'Hoge Raad')).toEqual({
			short: 'HR 19 juli 2019',
			full: 'HR 19 juli 2019, ECLI:NL:HR:2019:1278'
		});
	});
	it('names a rechtbank and a hof by their place', () => {
		expect(judgmentCite('ECLI:NL:RBDHA:2026:24524', '2026-07-06', 'Rechtbank Den Haag').full).toBe(
			'Rb. Den Haag 6 juli 2026, ECLI:NL:RBDHA:2026:24524'
		);
		expect(
			judgmentCite('ECLI:NL:GHAMS:2026:2673', '2026-09-22', 'Gerechtshof Amsterdam').short
		).toBe('Hof Amsterdam 22 september 2026');
	});
	it('goes without a date it does not have', () => {
		expect(judgmentCite('ECLI:NL:HR:2019:1278', null).full).toBe('HR, ECLI:NL:HR:2019:1278');
	});
});

describe('courtCite', () => {
	it('knows the courts that are cited by their abbreviation', () => {
		expect(courtCite('ECLI:NL:PHR:2019:496')).toBe('Conclusie');
		expect(courtCite('ECLI:NL:RVS:2026:5670')).toBe('ABRvS');
		expect(courtCite('ECLI:NL:CRVB:2026:404')).toBe('CRvB');
		expect(courtCite('ECLI:NL:CBB:2024:927')).toBe('CBb');
		expect(courtCite('ECLI:CE:ECHR:2026:0908JUD000748123')).toBe('EHRM');
		expect(courtCite('ECLI:EU:C:2020:12')).toBe('HvJ EU');
	});
	it('names a court by the code of its ECLI where no name is given, also one abolished (#62)', () => {
		expect(courtCite('ECLI:NL:RBMNE:2026:4501', null)).toBe('Rb. Midden-Nederland');
		expect(courtCite('ECLI:NL:RBUTR:2008:BF2034', 'RBUTR')).toBe('Rb. Utrecht');
		expect(courtCite('ECLI:NL:GHSGR:2010:BN1234', null)).toBe("Hof 's-Gravenhage");
	});
	it('falls back on the court without a place it knows', () => {
		expect(courtCite('ECLI:NL:RBXYZ:2026:1', null)).toBe('Rb.');
	});
});

describe('isConclusion', () => {
	it('knows a conclusion of the Parket by its ECLI or its key', () => {
		expect(isConclusion('ECLI:NL:PHR:2020:453')).toBe(true);
		expect(isConclusion('ecli_nl_phr_2020_453')).toBe(true);
		expect(isConclusion('ECLI:NL:HR:2020:453')).toBe(false);
		expect(isConclusion(null)).toBe(false);
	});
});

describe('paragraphCite', () => {
	it('cites a Dutch rechtsoverweging as r.o. and a paragraph of Strasbourg or Luxembourg as §', () => {
		expect(paragraphCite('ECLI:NL:HR:2019:1278', '3.1')).toBe('r.o. 3.1');
		expect(paragraphCite('ECLI:CE:ECHR:2026:0908JUD000748123', '9')).toBe('§ 9');
		expect(paragraphCite('ECLI:EU:C:2020:12', '45')).toBe('§ 45');
	});
	it('cites a paragraph of a conclusion of the Parket as the Hoge Raad does: onder 3.4', () => {
		expect(paragraphCite('ECLI:NL:PHR:2020:453', '3.4')).toBe('onder 3.4');
		expect(paragraphCite('ecli_nl_phr_2020_453', '3.4')).toBe('onder 3.4');
		expect(paragraphCite('judgments/ecli_ce_echr_2026_0908jud000748123', '9')).toBe('§ 9');
		expect(paragraphCite('ecli_nl_hr_2019_1278', '3.1')).toBe('r.o. 3.1');
	});
});

describe('authorCite', () => {
	it('names the A-G of a conclusion by surname, as it is cited', () => {
		expect(authorCite('T. Hartlief')).toBe('A-G Hartlief');
		expect(authorCite('P.J. Wattel')).toBe('A-G Wattel');
		expect(authorCite('Wattel')).toBe('A-G Wattel');
		expect(authorCite('E.M. Wesseling-van Gent')).toBe('A-G Wesseling-van Gent');
		expect(authorCite('J. Wortel', ['De Procureur-Generaal bij de', 'P-G'])).toBe('P-G Wortel');
		expect(authorCite(null)).toBeNull();
	});
	it('goes into the citation of the conclusion', () => {
		expect(judgmentCite('ECLI:NL:PHR:2020:453', '2020-05-08', null, 'A-G Hartlief').full).toBe(
			'Conclusie A-G Hartlief 8 mei 2020, ECLI:NL:PHR:2020:453'
		);
	});
});

describe('a conclusion in the status line', () => {
	it('names it by its A-G or P-G and its day, from the detail', () => {
		expect(
			conclusieNaam({
				ecli: 'ECLI:NL:PHR:2019:887',
				author: 'mr. Langemeijer en Wissink',
				role: 'procureur-generaal',
				date: '2019-09-13'
			})
		).toBe('P-G Langemeijer en Wissink, 13 september 2019');
		expect(
			conclusieNaam({
				ecli: 'ECLI:NL:PHR:2020:1',
				author: 'F.F. Hartlief',
				role: 'advocaat-generaal'
			})
		).toBe('A-G Hartlief');
		expect(conclusieNaam({ ecli: 'ecli:nl:phr:2019:887' })).toBe('ECLI:NL:PHR:2019:887');
	});
});

describe('overwegingCitaat', () => {
	const j = {
		ecli: 'ECLI:NL:HR:2019:2006',
		props: { date: '2019-12-20', court: 'Hoge Raad' },
		names: ['Urgenda']
	};
	it('cites an overweging and keeps it under the bron, grouped by its case', () => {
		expect(
			overwegingCitaat(j, '5.7.1', 'rov-5.7.1', 'https://x/#rov-5.7.1', 'judgments/k')
		).toEqual({
			kort: 'HR 20 december 2019, r.o. 5.7.1',
			voluit: 'HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1',
			link: 'https://x/#rov-5.7.1',
			bewaar: {
				id: 'judgments/k',
				at: 'rov-5.7.1',
				kort: 'HR 20 december 2019, r.o. 5.7.1',
				voluit: 'HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1',
				groep: 'HR 20 december 2019 (Urgenda)',
				groupKey: 'judgments/k'
			}
		});
	});
	it('offers no Bewaar without the bron, and nothing without an ECLI', () => {
		expect(overwegingCitaat(j, '1', 'rov-1', 'l', null)?.bewaar).toBeNull();
		expect(overwegingCitaat({ ...j, ecli: null }, '1', 'rov-1', 'l', 'judgments/k')).toBeNull();
	});
});
