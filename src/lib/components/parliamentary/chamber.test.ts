import { describe, expect, it } from 'vitest';
import { BOTH_CHAMBERS, CHAMBER_CHOICES, CHAMBER_OPTIONS } from './chamber';

describe('the Kamers as choices', () => {
	it('offers each Kamer by its name', () => {
		expect(CHAMBER_OPTIONS).toEqual([
			{ waarde: 'TK', label: 'Tweede Kamer' },
			{ waarde: 'EK', label: 'Eerste Kamer' }
		]);
	});

	it('offers both first, as a filter does', () => {
		expect(CHAMBER_CHOICES).toEqual([
			{ waarde: BOTH_CHAMBERS, label: 'Beide' },
			{ waarde: 'TK', label: 'Tweede Kamer' },
			{ waarde: 'EK', label: 'Eerste Kamer' }
		]);
	});
});
