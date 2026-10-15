import { beforeEach, describe, expect, it } from 'vitest';
import {
	deelAdres,
	haalTermWeg,
	isNieuw,
	lees,
	nieuwBezoek,
	ontvolgOnderwerp,
	topicKey,
	splitsTermen,
	topicsOf,
	vensterVan,
	voegTermenToe,
	volg,
	volgt,
	volgtWet,
	volgWet,
	wettenUitParams,
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
	it('follows a topic once, whatever its capitals and spaces', () => {
		volg(['Kunstmatige  intelligentie', 'AI']);
		volg(['ai']);
		expect(lees()).toEqual([
			{ termen: ['Kunstmatige intelligentie', 'AI'], vorige: null, gezien: null }
		]);
		expect(volgt('kunstmatige intelligentie')).toBe(true);
		ontvolgOnderwerp(lees()[0]);
		expect(lees()).toEqual([]);
	});

	it('counts a new visit from where the one before stood, once per session', () => {
		volg(['stikstof']);
		zetGezien('stikstof', '2026-10-02');
		zetGezien('stikstof', '2026-09-30');
		expect(nieuwBezoek(lees())[0]).toMatchObject({ vorige: '2026-10-02' });
		zetGezien('stikstof', '2026-10-08');
		expect(nieuwBezoek(lees())[0]).toMatchObject({ vorige: '2026-10-02', gezien: '2026-10-08' });
	});

	it('takes synonyms with ; or , in one topic, to add to and shorten later', () => {
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
		expect(topicsOf(new URLSearchParams('onderwerp=AI|ki|KI'))).toEqual([['AI', 'ki']]);
	});

	it('keeps the recent list of a topic of today in a new session', () => {
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

	it('carries the topics in the address there and back', () => {
		const adres = deelAdres([
			{ termen: ['kunstmatige intelligentie', 'AI'] },
			{ termen: ['stikstof'] }
		]);
		expect(topicsOf(new URL(adres, 'https://x').searchParams)).toEqual([
			['kunstmatige intelligentie', 'AI'],
			['stikstof']
		]);
	});

	it('follows a law or an article beside words, and carries it in the address', () => {
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
		expect(lijst.map(topicKey)).toEqual([
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
