import { describe, expect, it } from 'vitest';
import {
	actOf,
	caseNumberOf,
	comOf,
	eurLexAct,
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

describe('comOf', () => {
	it('reads the first COM number', () => {
		expect(comOf('Omnibus COM (2026) 560')).toEqual({ year: '2026', number: '560' });
		expect(comOf('ProtectEU COM(2026)101')).toEqual({ year: '2026', number: '101' });
		expect(comOf('Pakket (COM (2026) 502), (COM (2026) 503)')).toEqual({
			year: '2026',
			number: '502'
		});
	});
	it('gives nothing where the title names none', () => {
		expect(comOf('Actieplan tegen cyberpesten')).toBeNull();
	});
	it('builds the address of EUR-Lex', () => {
		expect(eurLexCom({ year: '2026', number: '560' })).toBe(
			'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=COM:2026:560:FIN'
		);
	});
});

describe('actOf', () => {
	it('reads a directive or a regulation', () => {
		expect(
			actOf('Regels ter implementatie van Richtlijn (EU) 2024/1640 en uitvoering van')
		).toEqual({
			kind: 'dir',
			year: '2024',
			number: '1640'
		});
		expect(actOf('Uitvoering van Verordening (EU) 2022/2065')?.kind).toBe('reg');
	});
	it('leaves out a number in the old form', () => {
		expect(actOf('implementatie van richtlijn 2008/98/EG')).toBeNull();
	});
	it('builds the ELI', () => {
		expect(eurLexAct({ kind: 'dir', year: '2024', number: '1640' })).toBe(
			'https://eur-lex.europa.eu/eli/dir/2024/1640/oj/nld'
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
		expect(caseNumberOf('HvJ EU 11 juni 2026, C-216/25')).toBe('C-216/25');
		expect(caseNumberOf('Gerecht EU 17 juni 2026, T-659/24')).toBe('T-659/24');
		expect(caseNumberOf('HR 20 december 2019')).toBeNull();
		expect(caseNumberOf(null)).toBeNull();
	});
	it('builds the address of EUR-Lex by the ECLI', () => {
		expect(eurLexEcli('ECLI:EU:C:2026:483')).toBe(
			'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=ecli:ECLI:EU:C:2026:483'
		);
	});
});
