import { describe, expect, it } from 'vitest';
import { COVERAGE, PUBLISHERS, SOURCE_LABEL } from './herkomst';

describe('the sources of Bronnen en hergebruik', () => {
	it('names the collections of the coverage as the page did', () => {
		expect(COVERAGE.map((c) => [c.collection, c.label])).toEqual([
			['instruments', 'Wetten en regelingen'],
			['articles', 'Artikelen'],
			['judgments', 'Uitspraken'],
			['dossiers', 'Dossiers'],
			['documents', 'Kamerstukken en andere documenten'],
			['members', 'Personen'],
			['committees', 'Commissies'],
			['cabinets', 'Kabinetten'],
			['commitments', 'Toezeggingen']
		]);
	});

	it('names each source of `data_as_of` as a reader knows it', () => {
		expect(SOURCE_LABEL).toEqual({
			bwb: 'wetten.overheid.nl',
			rechtspraak: 'rechtspraak.nl',
			echr: 'HUDOC',
			eurlex: 'EUR-Lex',
			tk: 'Tweede Kamer',
			eerstekamer: 'Eerste Kamer',
			staatsblad: 'Staatsblad',
			staatscourant: 'Staatscourant',
			rijksoverheid: 'rijksoverheid.nl',
			tooi: 'TOOI',
			verdragenbank: 'Verdragenbank'
		});
	});

	it('lists each publisher once, with its licence', () => {
		expect(PUBLISHERS.map((p) => p.name)).toEqual([
			'Wetgeving',
			'Rechtspraak',
			'EHRM',
			'Tweede Kamer',
			'Eerste Kamer',
			'Publicaties',
			'Regering',
			'Europees recht',
			'Verdragen',
			'Organisaties'
		]);
		expect(PUBLISHERS.every((p) => p.licence.url.startsWith('https://'))).toBe(true);
	});
});
