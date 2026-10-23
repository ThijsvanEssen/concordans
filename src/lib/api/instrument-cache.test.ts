import { describe, expect, it } from 'vitest';
import { fakeApi } from '$lib/test/fakeApi';
import {
	getInstrumentDetail,
	getInstrumentMeta,
	instrumentMetaStore,
	recordInstrument
} from './instrument-cache';
import { lawName } from '$lib/text/instrument-meta';

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

describe('a book of the BW in the cache', () => {
	it('keeps its short name as lawyers write it, for the hull and the band (#68)', () => {
		recordInstrument({
			bwb_id: 'BWBR0006000',
			title: 'Burgerlijk Wetboek Boek 7A',
			short_title: 'BW7A'
		});
		expect(getInstrumentMeta('BWBR0006000')?.shortTitle).toBe('Boek 7A BW');
	});
});

describe('what the cache tells its readers', () => {
	const settle = () => new Promise<void>((r) => queueMicrotask(r));

	it('tells only a real change: the same law recorded twice is news once', async () => {
		let told = 0;
		const stop = instrumentMetaStore.subscribe(() => told++);
		told = 0;
		const awb = { bwb_id: 'BWBR0005537', title: 'Algemene wet bestuursrecht', short_title: 'Awb' };
		recordInstrument(awb);
		await settle();
		expect(told).toBe(1);
		recordInstrument(awb);
		recordInstrument({ bwb_id: 'BWBR0005537' });
		await settle();
		expect(told).toBe(1);
		recordInstrument({ ...awb, citation_title: 'Awb 1992' });
		await settle();
		expect(told).toBe(2);
		expect(getInstrumentMeta('BWBR0005537')?.citationTitle).toBe('Awb 1992');
		stop();
	});
});

describe('a law of the Staatsblad the BWB does not hold yet', () => {
	it('asks a law of the Staatsblad by its law id and names it by that id', async () => {
		const api = fakeApi({
			'/api/instruments/{identifier}': {
				key: 'wet_stb_2026_56',
				bwb_id: null,
				citation_title: 'Wetboek van Strafvordering'
			}
		});
		await getInstrumentDetail('STB-2026-56');
		expect(api.asked('/api/instruments/{identifier}')[0].path).toEqual({
			identifier: 'STB-2026-56'
		});
		expect(getInstrumentMeta('STB-2026-56')?.citationTitle).toBe('Wetboek van Strafvordering');
	});
});
