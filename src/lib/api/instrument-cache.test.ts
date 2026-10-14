import { describe, expect, it } from 'vitest';
import { getInstrumentMeta, lawName, recordInstrument } from './instrument-cache';

describe('lawName', () => {
	it('names a law by its citation title, then its short title, then the fallback', () => {
		const meta = { bwbId: 'X', title: 'Wet X', shortTitle: 'WX', citationTitle: 'Wet X 2020' };
		expect(lawName(meta, 'X')).toBe('Wet X 2020');
		expect(lawName({ ...meta, citationTitle: null }, 'X')).toBe('WX');
		expect(lawName({ ...meta, citationTitle: null, shortTitle: null }, 'X')).toBe('X');
		expect(lawName(null, null)).toBeNull();
	});

	it('names a recorded law with only a title by that title', () => {
		recordInstrument({ bwb_id: 'BWBR0099991', title: 'Wet zonder citeertitel' });
		expect(lawName(getInstrumentMeta('BWBR0099991'), 'BWBR0099991')).toBe('Wet zonder citeertitel');
		recordInstrument({ bwb_id: 'BWBR0099992', short_title: 'Kort' });
		expect(lawName(getInstrumentMeta('BWBR0099992'), 'BWBR0099992')).toBe('Kort');
	});
});
