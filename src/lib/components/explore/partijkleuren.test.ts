import { describe, expect, it } from 'vitest';
import { patronen } from './partijkleuren.svelte';

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

	it('leaves a fractie of two colours, and its alias, full', () => {
		const p = patronen(TK);
		expect(p.get('groenlinks-pvda')).toBe('vol');
		expect(p.get('pro')).toBe('vol');
	});
});
