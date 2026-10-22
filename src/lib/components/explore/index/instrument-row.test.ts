import { describe, expect, it } from 'vitest';
import { euKind, instrumentKenmerk } from './instrument-row';

const row = (over: Record<string, unknown>) =>
	({ bwb_id: null, celex: null, jurisdiction: null, kind: null, ...over }) as never;

describe('what names an instrument in a list (B21)', () => {
	it('keeps the BWB id and the CELEX number', () => {
		expect(instrumentKenmerk(row({ bwb_id: 'bwbr0001840' }))).toBe('BWBR0001840');
		expect(instrumentKenmerk(row({ celex: '32016r0679' }))).toBe('32016R0679');
	});

	it('names a law of the Staatsblad by the publication that enacted it', () => {
		expect(instrumentKenmerk(row({ official_id: 'stb-2026-56' }))).toBe('Stb. 2026, 56');
	});

	it('names a treaty by its Verdragenbank number', () => {
		expect(instrumentKenmerk(row({ treaty_number: '010783' }))).toBe('Verdragsnr. 010783');
	});

	it('says nothing where the API has no kenmerk (an API before 0.81)', () => {
		expect(instrumentKenmerk(row({}))).toBe('');
	});

	it('names an act of the EU by its kind', () => {
		for (const [kind, name] of [
			['richtlijn', 'Richtlijn'],
			['verordening', 'Verordening'],
			['besluit', 'Besluit'],
			['kaderbesluit', 'Kaderbesluit']
		])
			expect(euKind(row({ jurisdiction: 'eu', kind }))).toBe(name);
		expect(euKind(row({ jurisdiction: 'eu', kind: null }))).toBeNull();
		expect(euKind(row({ jurisdiction: 'nl', kind: 'wet' }))).toBeNull();
	});
});
