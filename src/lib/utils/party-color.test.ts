import { describe, expect, it } from 'vitest';
import { NO_PARTY_COLOR, partyColor } from './party-color.svelte';

describe('partyColor', () => {
	it('is grey before the colours have come, and on the server', () => {
		expect(partyColor('VVD')).toBe(NO_PARTY_COLOR);
	});
});
