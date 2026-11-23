import { describe, expect, it } from 'vitest';
import { buildBronHref } from './href';
import { versieDoel, versieDoelOfFocus } from './versie';

describe('versie van een wet', () => {
	it('leest wet en dag uit de sleutel', () => {
		expect(versieDoel('instrument_versions', 'bwbr0005537_2022_05_01')).toEqual({
			law: 'bwbr0005537',
			peildatum: '2022-05-01'
		});
		expect(versieDoelOfFocus('instrument_versions/bwbr0005537_2022_05_01')?.law).toBe(
			'bwbr0005537'
		);
	});
	it('kent geen andere bron of sleutel', () => {
		expect(versieDoel('instruments', 'bwbr0005537')).toBeNull();
		expect(versieDoel('instrument_versions', 'rommel')).toBeNull();
	});
	it('opent als de wet op die dag', () => {
		const href = buildBronHref(null, {
			collection: 'instrument_versions',
			key: 'bwbr0005537_2022_05_01'
		});
		const u = new URL(href, 'https://x.nl');
		expect(u.pathname).toBe('/wetten/BWBR0005537');
		expect(u.searchParams.get('peildatum')).toBe('2022-05-01');
	});
});
