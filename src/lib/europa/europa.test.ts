import { describe, expect, it } from 'vitest';
import { actOf, comOf, eurLexAct, eurLexCom, euTitle } from './europa';

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
