import { describe, expect, it } from 'vitest';
import { opsomming } from './opsomming';

describe('opsomming', () => {
	it('leaves an empty part out, also the first', () => {
		expect(opsomming([null, 'Hoge Raad'])).toBe('Hoge Raad');
		expect(opsomming(['Uitspraak', '', '  ', 'Hoge Raad'])).toBe('Uitspraak, Hoge Raad');
		expect(opsomming(['Commissie', undefined, false, 'Tweede Kamer'])).toBe(
			'Commissie, Tweede Kamer'
		);
	});

	it('gives nothing for nothing, and keeps a number', () => {
		expect(opsomming([null, undefined])).toBe('');
		expect(opsomming(['Bijlage', 2])).toBe('Bijlage, 2');
	});
});
