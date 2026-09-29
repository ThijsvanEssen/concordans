import { describe, expect, it } from 'vitest';
import { rowKey, type Row } from './rows';

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
