import { describe, expect, it } from 'vitest';
import { bronKind } from './bron-kind';

describe('bronKind', () => {
	it('names a regeling by its own kind, never "Wet" for a beleidsregel', () => {
		expect(bronKind('instruments', { kind: 'beleidsregel', jurisdiction: 'nl' })).toBe(
			'Beleidsregel'
		);
		expect(bronKind('instruments', { kind: 'wet' })).toBe('Wet');
		expect(bronKind('instruments', { kind: 'publicatie' })).toBe('Publicatie');
		expect(
			bronKind('instruments', { jurisdiction: 'eu', citation_title: 'Richtlijn 2019/1158' })
		).toBe('Richtlijn');
		expect(bronKind('instruments', null)).toBe('Regeling');
	});

	it('names any other bron by its collection', () => {
		expect(bronKind('decisions', { kind: 'Stemmen - aangenomen' })).toBe('Stemming');
		expect(bronKind('documents', { kind: 'Motie' })).toBe('Stuk');
	});
});
