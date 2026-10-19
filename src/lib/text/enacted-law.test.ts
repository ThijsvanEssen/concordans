import { describe, expect, it } from 'vitest';
import {
	enactedLawId,
	enactedLawOfKey,
	enactedLawStatus,
	isEnactedLawItem,
	lawNodeKey,
	stbCitation
} from './enacted-law';
import { lawIdOf } from '$lib/graph/types';

describe('a law of the Staatsblad the BWB does not hold yet', () => {
	it('is named by its publication, in its address and its node key', () => {
		expect(enactedLawId('stb-2026-56')).toBe('STB-2026-56');
		expect(enactedLawId('kst-36799-31')).toBeNull();
		expect(enactedLawOfKey('wet_stb_2026_56')).toBe('STB-2026-56');
		expect(enactedLawOfKey('stb_2026_56')).toBeNull();
		expect(lawNodeKey('STB-2026-56')).toBe('wet_stb_2026_56');
		expect(lawNodeKey('BWBR0005289')).toBe('bwbr0005289');
	});

	it('is the law of its articles, not of its publication', () => {
		expect(lawIdOf({ bwb_id: null, official_id: 'stb-2026-56', article_number: '2.8.6' })).toBe(
			'STB-2026-56'
		);
		expect(lawIdOf({ official_id: 'stb-2026-56', publication_kind: 'Stb' })).toBeNull();
		expect(lawIdOf({ bwb_id: 'BWBR0001903', official_id: 'stb-2026-56' })).toBe('BWBR0001903');
	});

	it('says its status with its place in the Staatsblad', () => {
		expect(stbCitation('STB-2026-56')).toBe('Stb. 2026, 56');
		expect(enactedLawStatus('STB-2026-56')).toBe(
			'Vastgesteld, nog niet in werking (Stb. 2026, 56)'
		);
		expect(enactedLawStatus('BWBR0005289')).toBeNull();
	});

	it('knows its node ids, of the law and of its articles', () => {
		expect(isEnactedLawItem('instruments/wet_stb_2026_56')).toBe(true);
		expect(isEnactedLawItem('articles/stb_2026_56_2_8_6')).toBe(true);
		expect(isEnactedLawItem('instruments/stb_2026_56')).toBe(false);
		expect(isEnactedLawItem('articles/bwbr0005289_162')).toBe(false);
	});
});
