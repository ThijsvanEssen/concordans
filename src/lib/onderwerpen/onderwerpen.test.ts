import { beforeEach, describe, expect, it } from 'vitest';
import {
	deelAdres,
	haalTermWeg,
	isNieuw,
	lees,
	nieuwBezoek,
	ontvolg,
	ontvolgOnderwerp,
	sleutelVan,
	splitsTermen,
	uitParams,
	vensterVan,
	voegTermenToe,
	volg,
	volgt,
	volgtWet,
	volgWet,
	wettenUitParams,
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

	it('een onderwerp van vandaag houdt in een nieuwe sessie zijn recente lijst', () => {
		volg(['AI']);
		zetGezien('AI', '2026-10-08');
		sessionStorage.clear();
		const [o] = nieuwBezoek(lees());
		expect(o.vorige).toBe('2026-10-08');
		expect(vensterVan(o.vorige, '2026-09-08')).toBe('2026-09-08');
		expect(vensterVan('2026-08-01', '2026-09-08')).toBe('2026-08-01');
		expect(isNieuw('2026-10-08', o.vorige)).toBe(false);
		expect(isNieuw('2026-10-09', o.vorige)).toBe(true);
		expect(isNieuw('2026-10-09', null)).toBe(false);
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

	it('volgt een wet of een artikel naast woorden, en draagt die in het adres', () => {
		const cbw = { bwb: 'bwbr0052872', titel: 'Cyberbeveiligingswet' };
		volg(['Cyberbeveiligingswet']);
		volgWet(cbw);
		volgWet({ ...cbw, artikel: '3' });
		volgWet(cbw);
		const lijst = lees();
		expect(lijst.map((o) => o.termen[0])).toEqual([
			'Cyberbeveiligingswet',
			'Cyberbeveiligingswet',
			'artikel 3 Cyberbeveiligingswet'
		]);
		expect(lijst.map(sleutelVan)).toEqual([
			'cyberbeveiligingswet',
			'wet:BWBR0052872',
			'wet:BWBR0052872:3'
		]);
		// The word and the law are two topics: following one leaves the other.
		expect(volgt('cyberbeveiligingswet')).toBe(true);
		ontvolgOnderwerp(lijst[1]);
		expect(volgtWet(cbw)).toBe(false);
		expect(volgtWet({ ...cbw, artikel: '3' })).toBe(true);
		const adres = new URL(deelAdres(lees()), 'https://x');
		expect(adres.search).toBe('?onderwerp=Cyberbeveiligingswet&wet=BWBR0052872%2F3');
		expect(wettenUitParams(adres.searchParams)).toEqual([
			{ bwb: 'BWBR0052872', titel: 'BWBR0052872', artikel: '3' }
		]);
		expect(wettenUitParams(new URLSearchParams('wet=BWBR0005289/6:162&wet=onzin'))).toEqual([
			{ bwb: 'BWBR0005289', titel: 'BWBR0005289', artikel: '6:162' }
		]);
	});

	it('follows a treaty as a law: its BWB id is a BWBV', () => {
		expect(wettenUitParams(new URLSearchParams('wet=bwbv0001000'))).toEqual([
			{ bwb: 'BWBV0001000', titel: 'BWBV0001000', artikel: null }
		]);
	});
});
