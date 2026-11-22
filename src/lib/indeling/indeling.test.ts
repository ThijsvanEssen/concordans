import { describe, expect, it } from 'vitest';
import {
	articleHref,
	articleLabel,
	findGemeenten,
	hofName,
	judgmentsHref,
	perRechtbank,
	rechtbankName,
	sharesName,
	type Gemeente
} from './indeling';

const area = (code: string, name: string, article_number: string | null = null) => ({
	code,
	name,
	article_number
});
const gemeente = (code: string, name: string, province: string, district: string): Gemeente => ({
	code,
	name,
	province,
	district: area(`AR-${district}`, district, '8'),
	circuit: area('RT', 'Amsterdam', '14'),
	law_district: null,
	district_check: null,
	circuit_check: null
});
const items = [
	gemeente('GM1', 'Bergen', 'Noord-Holland', 'Noord-Holland'),
	gemeente('GM2', 'Bergen', 'Limburg', 'Limburg'),
	gemeente('GM3', '’s-Gravenhage', 'Zuid-Holland', 'Den Haag'),
	gemeente('GM4', 'Haarlem', 'Noord-Holland', 'Noord-Holland')
];

describe('Indeling', () => {
	it('names the courts as the CBS gives the areas', () => {
		expect(rechtbankName(area('AR', 'Noord-Holland'))).toBe('Rechtbank Noord-Holland');
		expect(hofName(area('RT', 'Amsterdam'))).toBe('Gerechtshof Amsterdam');
		expect(hofName(area('RT', 'Gerechtshof Arnhem-Leeuwarden'))).toBe(
			'Gerechtshof Arnhem-Leeuwarden'
		);
	});
	it('links the article of the RI, and none where the text names the area otherwise', () => {
		expect(articleHref(area('AR', 'x', '5a'))).toBe('/wetten/BWBR0002080/artikel/5a');
		expect(articleLabel(area('AR', 'x', '5a'))).toBe('art. 5a RI');
		expect(articleHref(area('AR', 'x'))).toBeNull();
	});
	it('finds a municipality by its beginning first, without the apostrophe', () => {
		expect(findGemeenten(items, 'ber').map((g) => g.code)).toEqual(['GM1', 'GM2']);
		expect(findGemeenten(items, 'gravenhage').map((g) => g.code)).toEqual(['GM3']);
		expect(findGemeenten(items, '  ')).toEqual([]);
	});
	it('tells two of one name apart', () => {
		expect(sharesName(items, items[0])).toBe(true);
		expect(sharesName(items, items[3])).toBe(false);
	});
	it('groups per arrondissement', () => {
		expect(perRechtbank(items).map((p) => [p.district.name, p.gemeenten.length])).toEqual([
			['Den Haag', 1],
			['Limburg', 1],
			['Noord-Holland', 2]
		]);
	});
	it('links the judgments of a court by its ECLI code, and none where it is not known', () => {
		expect(judgmentsHref('Rechtbank Noord-Holland')).toContain('court=RBNHO');
		expect(judgmentsHref('Gerechtshof ’s-Hertogenbosch')).toContain('court=GHSHE');
		expect(judgmentsHref('Rechtbank Elders')).toBeNull();
	});
});
