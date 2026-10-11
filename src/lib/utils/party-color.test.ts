import { describe, expect, it } from 'vitest';
import { eigenKleur } from '$lib/components/explore/partijkleuren.svelte';
import { NO_PARTY_COLOR, partyColor } from './party-color.svelte';

const colors = {
	VVD: '#003082',
	D66: '#1DB954',
	NSC: '#1B4F72',
	ChristenUnie: '#4F95D4',
	PvdD: '#4CAF50',
	'GroenLinks-PvdA': '#46962B'
};
const aliases = { CU: 'ChristenUnie', PRO: 'GroenLinks-PvdA', 'GL-PvdA': 'GroenLinks-PvdA' };

describe('eigenKleur', () => {
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

describe('partyColor', () => {
	it('is grey before the colours have come, and on the server', () => {
		expect(partyColor('VVD')).toBe(NO_PARTY_COLOR);
	});
});
