import { describe, expect, it } from 'vitest';
import { kopVanDossier, kopVanLid, kopVanUitspraak, kopVanWet } from './kop';

describe('kop', () => {
	it('builds a person under the id of their node', () => {
		const n = kopVanLid({ key: 'abc', name: 'Rob Jetten', party: 'D66' } as never);
		expect(n.id).toBe('members/abc');
		expect(n.label).toBe('Rob Jetten (D66)');
	});

	it('builds a judgment with its ECLI and props', () => {
		const n = kopVanUitspraak({
			key: 'ecli_nl_hr_2019_2006',
			ecli: 'ECLI:NL:HR:2019:2006',
			display_name: 'Hoge Raad 2019-12-20 / 19/00135',
			props: { court: 'Hoge Raad', date: '2019-12-20' }
		} as never);
		expect(n.id).toBe('judgments/ecli_nl_hr_2019_2006');
		expect(n.raw?.props).toMatchObject({ ecli: 'ECLI:NL:HR:2019:2006', court: 'Hoge Raad' });
	});

	it('builds a law with its BWB id', () => {
		const n = kopVanWet({
			key: 'bwbr0005537',
			bwb_id: 'BWBR0005537',
			display_name: 'Algemene wet bestuursrecht',
			short_title: 'Awb'
		} as never);
		expect(n.id).toBe('instruments/bwbr0005537');
		expect(n.raw?.props?.bwb_id).toBe('BWBR0005537');
	});

	it('builds a dossier with its number as label, as its reader and links read it', () => {
		const n = kopVanDossier({ key: '36547', number: '36547', title: 'Wet mensenhandel' } as never);
		expect(n.id).toBe('dossiers/36547');
		expect(n.raw?.props?.label).toBe('36547');
	});
});
