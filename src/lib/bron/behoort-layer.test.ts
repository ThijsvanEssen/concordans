import { describe, expect, it } from 'vitest';
import { outcomeOf } from './outcome-words';
import { dossierNummer } from './dossier-naam';

describe('outcomeOf', () => {
	it('names an instance of the procesgang by its remedy and outcome', () => {
		expect(outcomeOf('verworpen', 'Cassatie')).toBe('cassatie verworpen');
		expect(outcomeOf('bekrachtigd', null)).toBe('bekrachtigd');
		expect(outcomeOf(null, 'Cassatie')).toBeNull();
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
