import { describe, expect, it } from 'vitest';
import { eigenKleur, patronen } from './partijkleuren.svelte';

// The legend of the Tweede Kamer, June 2026, in its own order (`/api/parties/colors`).
const TK: Record<string, string[]> = {
	VVD: ['#E48230'],
	D66: ['#35A948'],
	PVV: ['#224665'],
	CDA: ['#00745A'],
	SP: ['#DA3230'],
	'GroenLinks-PvdA': ['#7AB841', '#D9232A'],
	ChristenUnie: ['#1D92C5'],
	Volt: ['#2A2350'],
	BBB: ['#B1BC53'],
	JA21: ['#253258'],
	SGP: ['#E05D29'],
	FVD: ['#7E3134'],
	DENK: ['#42B2AB'],
	'50PLUS': ['#812C7C'],
	PvdD: ['#006835'],
	'Groep Markuszower': ['#60899F'],
	'Lid Keijzer': ['#E36C9E'],
	PRO: ['#7AB841', '#D9232A']
};

describe('partijkleuren', () => {
	it('gives a fractie whose colour is like an earlier one a pattern', () => {
		const p = patronen(TK);
		expect(p.get('vvd')).toBe('vol');
		expect(p.get('pvv')).toBe('vol');
		expect(p.get('volt')).toBe('arcering');
		expect(p.get('ja21')).toBe('stippen');
		expect(p.get('sgp')).toBe('stippen');
		expect(p.get('pvdd')).toBe('arcering');
		expect(p.get('groep markuszower')).toBe('arcering');
	});

	it('gives a party no Kamer draws, after the legend, a pattern against a like colour', () => {
		const p = patronen({ ...TK, NSC: ['#1B4F72'] });
		expect(p.get('pvv')).toBe('vol');
		expect(p.get('nsc')).not.toBe('vol');
	});

	it('leaves a fractie of two colours, and its alias, full', () => {
		const p = patronen(TK);
		expect(p.get('groenlinks-pvda')).toBe('vol');
		expect(p.get('pro')).toBe('vol');
	});
});

describe('eigenKleur', () => {
	const colors = {
		VVD: '#003082',
		D66: '#1DB954',
		NSC: '#1B4F72',
		ChristenUnie: '#4F95D4',
		PvdD: '#4CAF50',
		'GroenLinks-PvdA': '#46962B'
	};
	const aliases = { CU: 'ChristenUnie', PRO: 'GroenLinks-PvdA', 'GL-PvdA': 'GroenLinks-PvdA' };

	it('takes the colour the API gives, by abbreviation or by its alias', () => {
		expect(eigenKleur('VVD', colors, aliases)).toBe('#003082');
		expect(eigenKleur('D66', colors, aliases)).toBe('#1DB954');
		expect(eigenKleur('NSC', colors, aliases)).toBe('#1B4F72');
		expect(eigenKleur('CU', colors, aliases)).toBe('#4F95D4');
		expect(eigenKleur('pro', colors, aliases)).toBe('#46962B');
		expect(eigenKleur('GL-PvdA', colors, aliases)).toBe('#46962B');
		expect(eigenKleur('PVDD', colors, aliases)).toBe('#4CAF50');
	});

	it('knows no party the API does not list, or before its aliases have come', () => {
		expect(eigenKleur('KVP', colors, aliases)).toBeUndefined();
		expect(eigenKleur('', colors, aliases)).toBeUndefined();
		expect(eigenKleur('CU', colors)).toBeUndefined();
	});
});
