import { describe, expect, it } from 'vitest';
import { officialPage, sourceCredit } from './judgment-source';

describe('the official page of a judgment', () => {
	it('is the one the API gives', () => {
		const url = 'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:62020CJ0160';
		expect(officialPage({ source: 'cjeu', ecli: 'ECLI:EU:C:2023:494', official_url: url })).toBe(
			url
		);
	});

	it('is found by its ECLI where the API gives none', () => {
		expect(officialPage({ source: 'cjeu', ecli: 'ECLI:EU:C:2023:494' })).toBe(
			'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=ecli:ECLI%3AEU%3AC%3A2023%3A494'
		);
		expect(officialPage({ source: 'rechtspraak', ecli: 'ECLI:NL:HR:2019:2006' })).toBe(
			'https://deeplink.rechtspraak.nl/uitspraak?id=ECLI%3ANL%3AHR%3A2019%3A2006'
		);
		expect(officialPage({ source: 'echr', ecli: 'ECLI:CE:ECHR:2026:1' })).toBeNull();
	});
});

describe('the credit under the text', () => {
	it('names the publisher of a European court', () => {
		expect(sourceCredit({ source: 'echr' })).toBe('Tekst: © ECHR-CEDH, uit HUDOC.');
		expect(sourceCredit({ source: 'cjeu' })).toBe('Tekst: © Europese Unie, uit EUR-Lex.');
		expect(sourceCredit({ source: 'rechtspraak' })).toBeNull();
	});
});
