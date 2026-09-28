import { describe, expect, it } from 'vitest';
import { colorFor, NO_PARTY_COLOR } from './party-color.svelte';

const colors = { VVD: '#003082', D66: '#1DB954', ChristenUnie: '#4F95D4', PvdD: '#4CAF50' };

describe('colorFor', () => {
	it('takes the colour the API gives, by abbreviation or alias', () => {
		expect(colorFor('VVD', colors)).toBe('#003082');
		expect(colorFor('D66', colors)).toBe('#1DB954');
		expect(colorFor('CU', colors)).toBe('#4F95D4');
		expect(colorFor('PVDD', colors)).toBe('#4CAF50');
	});

	it('leaves a party the API does not list grey', () => {
		expect(colorFor('KVP', colors)).toBe(NO_PARTY_COLOR);
		expect(colorFor('', colors)).toBe(NO_PARTY_COLOR);
	});
});
