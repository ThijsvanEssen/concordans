import { describe, expect, it } from 'vitest';
import { compareSuffix, groupByNumber, numberOf, suffixOf } from './dossier-number';

describe('numberOf and suffixOf', () => {
	it('split a label into number and suffix', () => {
		expect(numberOf('37035-XXII')).toBe('37035');
		expect(suffixOf('37035-XXII')).toBe('XXII');
		expect(numberOf('37020')).toBe('37020');
		expect(suffixOf('37020')).toBeNull();
		expect(numberOf('23908-(R1519)')).toBe('23908');
		expect(suffixOf('23908-(R1519)')).toBe('(R1519)');
	});
});

describe('compareSuffix', () => {
	it('orders no suffix, chapters by numeral, then funds by letter', () => {
		const labels = ['37020-M', '37020-XXIII', '37020-IIB', '37020-A', '37020', '37020-IX'];
		labels.push('37020-IV', '37020-IIA', '37020-X', '37020-I', '37020-L', '37020-C');
		expect(labels.sort(compareSuffix)).toEqual([
			'37020',
			'37020-I',
			'37020-IIA',
			'37020-IIB',
			'37020-IV',
			'37020-IX',
			'37020-X',
			'37020-XXIII',
			'37020-A',
			'37020-C',
			'37020-L',
			'37020-M'
		]);
	});

	it('orders numeric suffixes by value', () => {
		expect(['21501-31', '21501-02', '21501-7'].sort(compareSuffix)).toEqual([
			'21501-02',
			'21501-7',
			'21501-31'
		]);
	});
});

describe('groupByNumber', () => {
	it('keeps the order of first appearance and orders each group by suffix', () => {
		const rows = ['37035-XXII', '36327', '37035-J', '37035-III'].map((number) => ({ number }));
		expect(groupByNumber(rows)).toEqual([
			{
				number: '37035',
				rows: [{ number: '37035-III' }, { number: '37035-XXII' }, { number: '37035-J' }]
			},
			{ number: '36327', rows: [{ number: '36327' }] }
		]);
	});
});
