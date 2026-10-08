import { beforeEach, describe, expect, it } from 'vitest';
import {
	deelAdres,
	haalTermWeg,
	lees,
	nieuwBezoek,
	ontvolg,
	splitsTermen,
	uitParams,
	voegTermenToe,
	volg,
	volgt,
	woordIn,
	zetGezien
} from './onderwerpen';

function opslag(): Storage {
	const m = new Map<string, string>();
	return {
		get length() {
			return m.size;
		},
		clear: () => m.clear(),
		getItem: (k) => m.get(k) ?? null,
		key: (i) => [...m.keys()][i] ?? null,
		removeItem: (k) => void m.delete(k),
		setItem: (k, v) => void m.set(k, String(v))
	};
}

beforeEach(() => {
	globalThis.localStorage = opslag();
	globalThis.sessionStorage = opslag();
});

describe('onderwerpen', () => {
	it('volgt een onderwerp één keer, ongeacht hoofdletters en spaties', () => {
		volg(['Kunstmatige  intelligentie', 'AI']);
		volg(['ai']);
		expect(lees()).toEqual([
			{ termen: ['Kunstmatige intelligentie', 'AI'], vorige: null, gezien: null }
		]);
		expect(volgt('kunstmatige intelligentie')).toBe(true);
		ontvolg('AI');
		expect(lees()).toEqual([]);
	});

	it('een nieuw bezoek telt vanaf de stand van het vorige, één keer per sessie', () => {
		volg(['stikstof']);
		zetGezien('stikstof', '2026-10-02');
		zetGezien('stikstof', '2026-09-30');
		expect(nieuwBezoek(lees())[0]).toMatchObject({ vorige: '2026-10-02' });
		zetGezien('stikstof', '2026-10-08');
		expect(nieuwBezoek(lees())[0]).toMatchObject({ vorige: '2026-10-02', gezien: '2026-10-08' });
	});

	it('synoniemen met ; of , in één onderwerp, achteraf aan te vullen en in te korten', () => {
		volg(splitsTermen('AI; kunstmatige intelligentie, artificial intelligence; ai'));
		expect(lees()[0].termen).toEqual([
			'AI',
			'kunstmatige intelligentie',
			'artificial intelligence'
		]);
		voegTermenToe('ai', ['algoritme', 'Kunstmatige intelligentie']);
		expect(lees()[0].termen).toHaveLength(4);
		haalTermWeg('artificial intelligence');
		haalTermWeg('AI');
		haalTermWeg('kunstmatige intelligentie');
		expect(lees()[0].termen).toEqual(['algoritme']);
		expect(uitParams(new URLSearchParams('onderwerp=AI|ki;KI'))).toEqual([['AI', 'ki']]);
	});

	it('het adres draagt de onderwerpen heen en terug', () => {
		const adres = deelAdres([
			{ termen: ['kunstmatige intelligentie', 'AI'] },
			{ termen: ['stikstof'] }
		]);
		expect(uitParams(new URL(adres, 'https://x').searchParams)).toEqual([
			['kunstmatige intelligentie', 'AI'],
			['stikstof']
		]);
	});

	it('een woord begint waar een woord begint', () => {
		expect(woordIn('AI', 'De inzet van AI bij de IND')).toBe(true);
		expect(woordIn('AI', 'AI-verordening')).toBe(true);
		expect(woordIn('AI', 'onderzoekers zonder universitaire aanstelling')).toBe(false);
		expect(woordIn('AI', 'Kabinetsreactie AIV-advies EU-uitbreiding')).toBe(false);
		expect(woordIn('AI', 'Groningen Airport Eelde')).toBe(false);
		expect(woordIn('algoritme', 'Algoritmeregister')).toBe(true);
		expect(woordIn('AI', null)).toBe(false);
	});
});
