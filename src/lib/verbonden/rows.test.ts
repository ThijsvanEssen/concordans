import { describe, expect, it } from 'vitest';
import { describe as describeBron, rowKey, type Row } from './rows';

describe('rowKey', () => {
	it('tells apart two references from one article', () => {
		const row = (edgeId: string) =>
			({
				ref: { collection: 'articles', key: 'bwbr0005289_13' },
				title: 'Artikel 6:13',
				context: null,
				kind: 'artikelen',
				edgeId
			}) as Row;
		expect(rowKey(row('e1'))).not.toBe(rowKey(row('e2')));
	});
});

describe('a conclusion', () => {
	it('is named by its author, as it is cited', () => {
		const props = {
			court: 'PHR',
			date: '2018-08-02',
			advocate_general: 'mr. R.E.C.M. Niessen',
			advocate_general_role: 'advocaat-generaal'
		};
		expect(describeBron('judgments', 'ecli_nl_phr_2018_1', 'x', props).title).toBe(
			'Conclusie A-G Niessen, 2 augustus 2018'
		);
	});
});
