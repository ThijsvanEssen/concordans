import { describe, expect, it } from 'vitest';
import { overwegingCitaat, citeOverwegingen } from './judgment-cite';
import { headingCite } from './judgment-heading';
import { linkTo, permalink, viewLink } from '$lib/bron/landing';

describe('overwegingCitaat', () => {
	const j = {
		ecli: 'ECLI:NL:HR:2019:2006',
		cite: { short: 'HR 20 december 2019', full: 'HR 20 december 2019, ECLI:NL:HR:2019:2006' },
		names: ['Urgenda']
	};
	it('cites an overweging after the judgment as the API cites it, kept grouped by its case', () => {
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
	it('cites a point of a conclusion as onder', () => {
		const conclusie = {
			ecli: 'ECLI:NL:PHR:2020:453',
			cite: {
				short: 'Conclusie A-G Hartlief 8 mei 2020',
				full: 'Conclusie A-G Hartlief 8 mei 2020, ECLI:NL:PHR:2020:453'
			}
		};
		expect(overwegingCitaat(conclusie, '3.4', 'rov-3.4', 'l', null)?.kort).toBe(
			'Conclusie A-G Hartlief 8 mei 2020, onder 3.4'
		);
	});
	it('offers no Bewaar without the bron, and nothing without a citation', () => {
		expect(overwegingCitaat(j, '1', 'rov-1', 'l', null)?.bewaar).toBeNull();
		expect(overwegingCitaat({ ...j, cite: null }, '1', 'rov-1', 'l', 'judgments/k')).toBeNull();
	});
});

describe('the overwegingen of one judgment', () => {
	const j = {
		ecli: 'ECLI:NL:HR:2019:2006',
		cite: { short: 'HR 20 december 2019', full: 'HR 20 december 2019, ECLI:NL:HR:2019:2006' },
		names: ['Urgenda']
	};
	const url = new URL('https://concordans.nl/uitspraken/ECLI:NL:HR:2019:2006?lezen=1#rov-4.2');

	it('cite each as overwegingCitaat does, the judgment read once', () => {
		const citeer = citeOverwegingen(j, 'judgments/k');
		const basis = viewLink(url);
		for (const num of ['4.2', '5.7.1', '9']) {
			const anker = `rov-${num}`;
			expect(citeer?.(num, anker, linkTo(basis, anker))).toEqual(
				overwegingCitaat(j, num, anker, permalink(url, anker), 'judgments/k')
			);
		}
		expect(citeOverwegingen({ ...j, cite: null }, 'judgments/k')).toBeNull();
	});

	it('link to the view without its hash: another overweging chosen is the same link', () => {
		expect(viewLink(url)).toBe(permalink(url, ''));
		expect(viewLink(new URL(url.href.replace('#rov-4.2', '#rov-9')))).toBe(viewLink(url));
	});
});

describe('a judgment of the courts of the EU', () => {
	// As the Court is cited in Dutch: "HvJ EU 22 juni 2023, C-160/20, ECLI:EU:C:2023:494".
	const hof = {
		ecli: 'ECLI:EU:C:2023:494',
		cite: { short: 'HvJ EU 22 juni 2023', full: 'HvJ EU 22 juni 2023, ECLI:EU:C:2023:494' },
		props: { case_number: 'C-160/20' }
	};

	it('is cited with its case number after the day', () => {
		expect(headingCite(hof)).toEqual({
			short: 'HvJ EU 22 juni 2023, C-160/20',
			full: 'HvJ EU 22 juni 2023, C-160/20, ECLI:EU:C:2023:494'
		});
		const gerecht = {
			ecli: 'ECLI:EU:T:2023:12',
			cite: {
				short: 'Gerecht EU 1 maart 2023',
				full: 'Gerecht EU 1 maart 2023, ECLI:EU:T:2023:12'
			},
			case_number: 'T-441/21'
		};
		expect(headingCite(gerecht)?.short).toBe('Gerecht EU 1 maart 2023, T-441/21');
	});

	it('cites a point of it as punt, after the case number', () => {
		expect(overwegingCitaat(hof, '45', 'rov-45', 'l', null)).toMatchObject({
			kort: 'HvJ EU 22 juni 2023, C-160/20, punt 45',
			voluit: 'HvJ EU 22 juni 2023, C-160/20, ECLI:EU:C:2023:494, punt 45'
		});
	});

	it('adds nothing the API already cites, nor to a Dutch judgment', () => {
		const given = { ...hof, cite: headingCite(hof) };
		expect(headingCite(given)).toEqual(headingCite(hof));
		const hr = {
			ecli: 'ECLI:NL:HR:2019:2006',
			cite: { short: 'HR 20 december 2019', full: 'HR 20 december 2019, ECLI:NL:HR:2019:2006' },
			props: { case_number: '19/00135' }
		};
		expect(headingCite(hr)).toEqual(hr.cite);
	});
});
