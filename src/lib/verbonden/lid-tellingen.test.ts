import { describe, expect, it } from 'vitest';
import { lidTellingenOnder } from './view';

// Artikel 3:4 Awb on prod, API 0.79.17.
const per = new Map([
	[
		'articles',
		new Map([
			['', 7],
			['2', 4]
		])
	],
	[
		'documents',
		new Map([
			['', 48],
			['1', 7],
			['2', 19]
		])
	],
	[
		'judgments',
		new Map([
			['', 3052],
			['1', 874],
			['2', 3321]
		])
	]
]);

describe('lidTellingenOnder', () => {
	it('adds every bucket without a bronfilter', () => {
		expect(lidTellingenOnder(per, null)?.get('2')).toBe(3344);
	});

	it('adds the buckets of the kinds that are on', () => {
		const counts = lidTellingenOnder(per, new Set(['uitspraken']));
		expect([counts?.get('1'), counts?.get('2')]).toEqual([874, 3321]);
		expect(lidTellingenOnder(per, new Set(['uitspraken', 'artikelen']))?.get('2')).toBe(3325);
	});

	it('leaves it to the rows where the filter splits the stukken of one bucket', () => {
		expect(lidTellingenOnder(per, new Set(['toelichtingen']))).toBeNull();
		const stukken = lidTellingenOnder(
			per,
			new Set(['toelichtingen', 'wetsvoorstellen', 'dossiers'])
		);
		expect(stukken?.get('2')).toBe(19);
	});
});
