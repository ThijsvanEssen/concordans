import { describe, expect, it } from 'vitest';
import {
	articleHref,
	riLabel,
	findMunicipalities,
	circuitName,
	judgmentsHref,
	byDistrict,
	districtName,
	sharesName,
	type Municipality
} from './court-map';

const area = (code: string, name: string, article_number: string | null = null) => ({
	code,
	name,
	article_number
});
const municipality = (
	code: string,
	name: string,
	province: string,
	district: string
): Municipality => ({
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
	municipality('GM1', 'Bergen', 'Noord-Holland', 'Noord-Holland'),
	municipality('GM2', 'Bergen', 'Limburg', 'Limburg'),
	municipality('GM3', '’s-Gravenhage', 'Zuid-Holland', 'Den Haag'),
	municipality('GM4', 'Haarlem', 'Noord-Holland', 'Noord-Holland')
];

describe('Court map', () => {
	it('names the courts as the CBS gives the areas', () => {
		expect(districtName(area('AR', 'Noord-Holland'))).toBe('Rechtbank Noord-Holland');
		expect(circuitName(area('RT', 'Amsterdam'))).toBe('Gerechtshof Amsterdam');
		expect(circuitName(area('RT', 'Gerechtshof Arnhem-Leeuwarden'))).toBe(
			'Gerechtshof Arnhem-Leeuwarden'
		);
	});
	it('links the article of the RI, and none where the text names the area otherwise', () => {
		expect(articleHref(area('AR', 'x', '5a'))).toBe('/wetten/BWBR0002080/artikel/5a');
		expect(riLabel(area('AR', 'x', '5a'))).toBe('art. 5a RI');
		expect(articleHref(area('AR', 'x'))).toBeNull();
	});
	it('finds a municipality by its beginning first, without the apostrophe', () => {
		expect(findMunicipalities(items, 'ber').map((g) => g.code)).toEqual(['GM1', 'GM2']);
		expect(findMunicipalities(items, 'gravenhage').map((g) => g.code)).toEqual(['GM3']);
		expect(findMunicipalities(items, '  ')).toEqual([]);
	});
	it('tells two of one name apart', () => {
		expect(sharesName(items, items[0])).toBe(true);
		expect(sharesName(items, items[3])).toBe(false);
	});
	it('groups per arrondissement', () => {
		expect(byDistrict(items).map((p) => [p.district.name, p.municipalities.length])).toEqual([
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
