import { describe, expect, it } from 'vitest';
import { FILTER_GROUPS } from '$lib/verbonden/filter';
import { SORT_SHAPE, VORMEN, VORM_VAN, vormVan, vormVanBron } from './vormen';

describe('vormen', () => {
	it('gives every collection a shape that exists', () => {
		for (const vorm of Object.values(VORM_VAN)) expect(VORMEN[vorm]).toBeDefined();
	});

	it('gives every kind in the bronfilter a shape', () => {
		for (const kind of FILTER_GROUPS) expect(VORMEN[SORT_SHAPE[kind]]).toBeDefined();
	});

	it('reads the shape from an id', () => {
		expect(vormVan('judgments/ecli_nl_hr_2019_2007')).toBe('uitspraak');
		expect(vormVan('articles/bwbr0005537_3_4')).toBe('regel-o');
		expect(vormVan('unknown/x')).toBe('overig');
	});

	it('draws a bill apart from an explanatory document', () => {
		expect(vormVanBron('documents', { kind: 'Voorstel van wet' })).toBe('voorstel');
		expect(vormVanBron('documents', { kind: 'Nota van wijziging' })).toBe('voorstel');
		expect(vormVanBron('documents', { kind: 'Memorie van toelichting' })).toBe('stuk');
		expect(vormVanBron('documents', null)).toBe('stuk');
		expect(vormVanBron('dossiers', { kind: 'Voorstel van wet' })).toBe('dossier');
	});
});

describe('a European or international regeling', () => {
	it('has a square with a hole of its own, on the canvas and in the bronfilter', () => {
		expect(vormVanBron('instruments', { jurisdiction: 'eu' }, 'celex_32016r0679')).toBe(
			'regel-int'
		);
		expect(vormVanBron('instruments', { jurisdiction: 'nl' }, 'bwbr0005289')).toBe('regel');
		expect(SORT_SHAPE.internationaal).toBe('regel-int');
		expect(SORT_SHAPE.internationaal).not.toBe(SORT_SHAPE.wetten);
		expect(VORMEN['regel-int'].wijze).toBe('gat');
	});
});
