import { describe, expect, it } from 'vitest';
import { BRON_KINDS } from '$lib/verbonden/filter';
import { BRON_KIND_VORM, VORMEN, VORM_VAN, vormVan, vormVanBron } from './vormen';

describe('vormen', () => {
	it('gives every collection a shape that exists', () => {
		for (const vorm of Object.values(VORM_VAN)) expect(VORMEN[vorm]).toBeDefined();
	});

	it('gives every kind in the bronfilter a shape', () => {
		for (const kind of BRON_KINDS) expect(VORMEN[BRON_KIND_VORM[kind]]).toBeDefined();
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
