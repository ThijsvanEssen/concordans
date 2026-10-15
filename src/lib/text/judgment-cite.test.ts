import { describe, expect, it } from 'vitest';
import { overwegingCitaat, citeOverwegingen } from './judgment-cite';
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
