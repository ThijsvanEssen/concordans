import { describe, expect, it } from 'vitest';
import { isConclusion, paragraphCite } from './ecli';

describe('isConclusion', () => {
	it('knows a conclusion of the Parket by its ECLI or its key', () => {
		expect(isConclusion('ECLI:NL:PHR:2020:453')).toBe(true);
		expect(isConclusion('ecli_nl_phr_2020_453')).toBe(true);
		expect(isConclusion('ECLI:NL:HR:2020:453')).toBe(false);
		expect(isConclusion(null)).toBe(false);
	});
});

describe('paragraphCite', () => {
	it('cites a Dutch rechtsoverweging as r.o., a paragraph of Strasbourg as § and of Luxembourg as punt', () => {
		expect(paragraphCite('ECLI:NL:HR:2019:1278', '3.1')).toBe('r.o. 3.1');
		expect(paragraphCite('ECLI:CE:ECHR:2026:0908JUD000748123', '9')).toBe('§ 9');
		// As the Court cites itself in Dutch: "C-362/14, EU:C:2015:650, punt 73".
		expect(paragraphCite('ECLI:EU:C:2020:12', '45')).toBe('punt 45');
		expect(paragraphCite('ecli_eu_t_2021_441', '7')).toBe('punt 7');
	});
	it('cites a paragraph of a conclusion of the Parket as the Hoge Raad does: onder 3.4', () => {
		expect(paragraphCite('ECLI:NL:PHR:2020:453', '3.4')).toBe('onder 3.4');
		expect(paragraphCite('ecli_nl_phr_2020_453', '3.4')).toBe('onder 3.4');
		expect(paragraphCite('judgments/ecli_ce_echr_2026_0908jud000748123', '9')).toBe('§ 9');
		expect(paragraphCite('ecli_nl_hr_2019_1278', '3.1')).toBe('r.o. 3.1');
	});
});
