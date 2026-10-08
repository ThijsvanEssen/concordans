import { describe, expect, it } from 'vitest';
import { kolomPlekken, kolomVan } from './kolommen';

describe('kolommen', () => {
	it('puts parliament left, the law in the middle and the judgments right', () => {
		expect([kolomVan('documents'), kolomVan('articles'), kolomVan('judgments')]).toEqual([0, 1, 2]);
		expect(kolomVan('dossiers')).toBe(0);
	});

	it('spreads each column over its height, in the order given', () => {
		const p = kolomPlekken(
			[
				{ id: 'd1', collection: 'documents' },
				{ id: 'd2', collection: 'documents' },
				{ id: 'a', collection: 'articles' },
				{ id: 'j', collection: 'judgments' }
			],
			0,
			0,
			100,
			40
		);
		expect([p.get('d1'), p.get('d2'), p.get('a'), p.get('j')]).toEqual([
			{ x: -100, y: -20 },
			{ x: -100, y: 20 },
			{ x: 0, y: 0 },
			{ x: 100, y: 0 }
		]);
	});
});
