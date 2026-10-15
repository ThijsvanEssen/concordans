import { describe, expect, it } from 'vitest';
import { dossierNummer, uitkomstVan } from './behoort-layer';

describe('uitkomstVan', () => {
	it('names an instance of the procesgang by its remedy and outcome', () => {
		expect(uitkomstVan('verworpen', 'Cassatie')).toBe('cassatie verworpen');
		expect(uitkomstVan('bekrachtigd', null)).toBe('bekrachtigd');
		expect(uitkomstVan(null, 'Cassatie')).toBeNull();
	});
});

describe('the number of a dossier', () => {
	it('keeps its suffix, from the label or from number and suffix', () => {
		expect(dossierNummer({ number: '36600', suffix: 'VII', label: '36600-VII' })).toBe('36600-VII');
		expect(dossierNummer({ number: '36600', suffix: 'VII' })).toBe('36600-VII');
		expect(dossierNummer({ number: '36496' })).toBe('36496');
		expect(dossierNummer({})).toBeNull();
	});
});
