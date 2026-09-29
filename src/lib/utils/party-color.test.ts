import { describe, expect, it } from 'vitest';
import { colorFor, NO_PARTY_COLOR } from './party-color.svelte';

const colors = {
	VVD: '#003082',
	D66: '#1DB954',
	ChristenUnie: '#4F95D4',
	PvdD: '#4CAF50',
	'GroenLinks-PvdA': '#46962B'
};
const aliases = { CU: 'ChristenUnie', PRO: 'GroenLinks-PvdA', 'GL-PvdA': 'GroenLinks-PvdA' };

describe('colorFor', () => {
	it('takes the colour the API gives, by abbreviation or by its alias', () => {
		expect(colorFor('VVD', colors, aliases)).toBe('#003082');
		expect(colorFor('D66', colors, aliases)).toBe('#1DB954');
		expect(colorFor('CU', colors, aliases)).toBe('#4F95D4');
		expect(colorFor('pro', colors, aliases)).toBe('#46962B');
		expect(colorFor('GL-PvdA', colors, aliases)).toBe('#46962B');
		expect(colorFor('PVDD', colors, aliases)).toBe('#4CAF50');
	});

	it('leaves a party grey that the API does not list, or before its aliases have come', () => {
		expect(colorFor('KVP', colors, aliases)).toBe(NO_PARTY_COLOR);
		expect(colorFor('', colors, aliases)).toBe(NO_PARTY_COLOR);
		expect(colorFor('CU', colors)).toBe(NO_PARTY_COLOR);
	});
});
