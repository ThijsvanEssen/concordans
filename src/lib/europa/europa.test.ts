import { describe, expect, it } from 'vitest';
import {
	actOfCelex,
	unionCaseNumber,
	eurLexCelex,
	eurLexCom,
	eurLexEcli,
	euTitle,
	proposalKind
} from './europa';

describe('euTitle', () => {
	it('drops the label of the Kamer', () => {
		expect(euTitle('EU-voorstel: Omnibus over belastingen COM (2026) 560')).toBe(
			'Omnibus over belastingen COM (2026) 560'
		);
		expect(euTitle('EU-voorstellen: Pakket  X')).toBe('Pakket X');
	});
});

describe('eurLexCom', () => {
	it('builds the address from the COM number of the API', () => {
		expect(eurLexCom('COM(2026) 560')).toBe(
			'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=COM:2026:560:FIN'
		);
		expect(eurLexCom('COM (2026) 101')).toContain('COM:2026:101:FIN');
	});
	it('gives nothing for another form', () => {
		expect(eurLexCom('JOIN(2026) 4')).toBeNull();
	});
});

describe('actOfCelex', () => {
	it('reads a directive or a regulation', () => {
		expect(actOfCelex('32024L2811')).toEqual({ kind: 'Richtlijn', number: '2024/2811' });
		expect(actOfCelex('32008L0098')).toEqual({ kind: 'Richtlijn', number: '2008/98' });
		expect(actOfCelex('32022R2065')?.kind).toBe('Verordening');
	});
	it('leaves out another sector', () => {
		expect(actOfCelex('52025PC0080')).toBeNull();
	});
	it('builds the address by CELEX', () => {
		expect(eurLexCelex('32024L2811')).toBe(
			'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32024L2811'
		);
	});
});

describe('proposalKind', () => {
	it('names what the title says it is', () => {
		expect(proposalKind('EU-voorstel: Commissiemededeling: Actieplan tegen cyberpesten')).toBe(
			'Mededeling'
		);
		expect(proposalKind('EU-voorstel: Gezamenlijke mededeling inzake economische veiligheid')).toBe(
			'Mededeling'
		);
		expect(proposalKind('EU-voorstellen: Besluit van de Raad betreffende de sluiting')).toBe(
			'Raadsbesluit'
		);
		expect(proposalKind('EU-voorstel: Voorstel voor een Verordening tot wijziging')).toBe(
			'Voorstel'
		);
	});
});

describe('the judgments of the Union', () => {
	it('reads the case number from the citation', () => {
		expect(unionCaseNumber('HvJ EU 11 juni 2026, C-216/25')).toBe('C-216/25');
		expect(unionCaseNumber('Gerecht EU 17 juni 2026, T-659/24')).toBe('T-659/24');
		expect(unionCaseNumber('HR 20 december 2019')).toBeNull();
		expect(unionCaseNumber(null)).toBeNull();
	});
	it('builds the address of EUR-Lex by the ECLI', () => {
		expect(eurLexEcli('ECLI:EU:C:2026:483')).toBe(
			'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=ecli:ECLI:EU:C:2026:483'
		);
	});
});
