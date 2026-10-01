import { describe, expect, it } from 'vitest';
import {
	focusIn,
	focusOfPad,
	isVerkenner,
	padHref,
	padOfFocus,
	parsePad,
	remember,
	verkennerHref
} from './leesbaar';

describe('a readable address', () => {
	it('reads the official identifier from the path', () => {
		expect(parsePad('/uitspraken/ECLI:NL:HR:2019:2006')).toEqual({
			soort: 'uitspraak',
			ecli: 'ECLI:NL:HR:2019:2006'
		});
		expect(parsePad('/wetten/BWBR0005289/artikel/6:162')).toEqual({
			soort: 'artikel',
			wet: 'BWBR0005289',
			nummer: '6:162'
		});
		expect(parsePad('/dossiers/36600-VIII')).toEqual({ soort: 'dossier', nummer: '36600-VIII' });
		expect(parsePad('/kamerstukken/36799/31')).toEqual({
			soort: 'kamerstuk',
			dossier: '36799',
			nummer: '31'
		});
	});

	it('reads the letter of a stuk of the Eerste Kamer', () => {
		expect(parsePad('/kamerstukken/36600-VIII/ab')).toEqual({
			soort: 'kamerstuk',
			dossier: '36600-VIII',
			nummer: 'AB'
		});
	});

	it('leaves every other page alone', () => {
		for (const path of [
			'/',
			'/explore',
			'/docs',
			'/uitspraken',
			'/dossiers/abc',
			'/kamerstukken/36799/A1'
		])
			expect(parsePad(path)).toBeNull();
		expect(isVerkenner('/explore')).toBe(true);
		expect(isVerkenner('/dossiers/36799')).toBe(true);
		expect(isVerkenner('/docs')).toBe(false);
	});

	it('writes the path with its colons as they are', () => {
		expect(padHref({ soort: 'artikel', wet: 'BWBR0005537', nummer: '3:4' })).toBe(
			'/wetten/BWBR0005537/artikel/3:4'
		);
	});

	it('names a judgment and a dossier without a request', () => {
		expect(focusOfPad({ soort: 'uitspraak', ecli: 'ECLI:NL:HR:2019:2006' })).toBe(
			'judgments/ecli_nl_hr_2019_2006'
		);
		expect(focusOfPad({ soort: 'dossier', nummer: '36600-VIII' })).toBe('dossiers/36600-VIII');
		expect(focusIn(new URL('http://x/uitspraken/ECLI:NL:HR:2019:2006?lezen=1'))).toBe(
			'judgments/ecli_nl_hr_2019_2006'
		);
		expect(focusIn(new URL('http://x/explore?focus=members/m'))).toBe('members/m');
	});
});

describe('the address of a focus', () => {
	it('gives an article its number as cited, a BW article with its book', () => {
		expect(
			padOfFocus('articles/bwbr0005289_162', { bwb_id: 'BWBR0005289', article_number: '162' })
		).toBe('/wetten/BWBR0005289/artikel/6:162');
		expect(
			padOfFocus('articles/32017l1132_27', { celex: '32017L1132', article_number: '27' })
		).toBe('/wetten/32017L1132/artikel/27');
	});

	it('gives a Kamerstuk its number, or the letter of the Eerste Kamer', () => {
		expect(padOfFocus('documents/1501fbca', { dossier_number: '36799', sequence: 31 })).toBe(
			'/kamerstukken/36799/31'
		);
		expect(padOfFocus('documents/ek_kst_1', { dossier_number: '32317', number: 'QK' })).toBe(
			'/kamerstukken/32317/QK'
		);
		expect(
			padOfFocus('documents/ek_kst_2', {
				dossier_number: '36600',
				dossier_suffix: 'VIII',
				number: 'AB'
			})
		).toBe('/kamerstukken/36600-VIII/AB');
		expect(padOfFocus('members/49be')).toBeNull();
	});

	it('keeps the query and moves the focus into the path', () => {
		const params = new URLSearchParams('focus=dossiers/36799&lezen=1');
		expect(verkennerHref(params, '#stemming')).toBe('/dossiers/36799?lezen=1#stemming');
		expect(verkennerHref(new URLSearchParams('focus=members/m'))).toBe('/explore?focus=members/m');
	});

	it('remembers an address it looked up, both ways', () => {
		remember('/kamerstukken/36799/31', 'documents/1501fbca');
		expect(focusOfPad({ soort: 'kamerstuk', dossier: '36799', nummer: '31' })).toBe(
			'documents/1501fbca'
		);
		expect(padOfFocus('documents/1501fbca')).toBe('/kamerstukken/36799/31');
	});
});
