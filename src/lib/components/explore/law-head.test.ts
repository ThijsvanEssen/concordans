import { describe, expect, it } from 'vitest';
import { lawFullTitle, lawKind, sourceName } from './law-head';

const eu = {
	kind: null,
	title:
		'Verordening (EU) 2022/868 van het Europees Parlement en de Raad van 30 mei 2022 (Datagovernanceverordening)',
	citation_title: 'Verordening (EU) 2022/868',
	official_title: null,
	official_url: 'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32022R0868',
	jurisdiction: 'eu'
};

describe('the head of a law', () => {
	it('names an act of the EU by its kind', () => {
		expect(lawKind(eu)).toBe('Verordening');
		expect(lawKind({ ...eu, citation_title: 'Richtlijn 95/46/EG' })).toBe('Richtlijn');
		expect(lawKind({ ...eu, kind: 'wet', jurisdiction: 'nl' })).toBe('Wet');
		expect(lawKind(null)).toBe('Regeling');
	});
	it('gives the full title where the official title is missing', () => {
		expect(lawFullTitle(eu, 'Verordening (EU) 2022/868')).toBe(eu.title);
		expect(
			lawFullTitle({ ...eu, title: 'Verordening (EU) 2022/868' }, 'Verordening (EU) 2022/868')
		).toBeNull();
	});
	it('names the site of the official text', () => {
		expect(sourceName(eu.official_url)).toBe('eur-lex.europa.eu');
		expect(sourceName('https://wetten.overheid.nl/BWBR0005537')).toBe('wetten.overheid.nl');
		expect(sourceName(null)).toBeNull();
	});
});
