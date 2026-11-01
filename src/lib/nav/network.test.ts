// B85: which bron the lezer shows and which are chosen, in the states of the design.
import { describe, expect, it } from 'vitest';
import { focusIn } from '$lib/bron/address';
import { parseNetwerk, type Netwerk } from '$lib/selection/netwerk';
import { lezerBron, metLezer, naWeghalen, networkCount, networkHref } from './network';

const WVW = 'instruments/bwbr0006622';
const CBB = 'instruments/bwbr0052875';
const DOSSIER = 'dossiers/36702';
const at = (href: string) => new URL(href, 'https://concordans.nl');
const net = (...ids: string[]): Netwerk => ({ ids, uit: new Set() });
const chosen = (query: string, focus: string | null) =>
	parseNetwerk(new URLSearchParams(metLezer(query, focus))).ids;

describe('the link of Thijs: the path says WVW, netwerk= only Cbb', () => {
	const link = at(
		`/wetten/BWBR0006622?doek=banen&diepte=2&voorstellen=ja&mode=netwerk&netwerk=${CBB}&weergave=keten`
	);
	it('names the bron of the page as the focus a netwerk uses', () => {
		expect(focusIn(link)).toBe(WVW);
	});
	it('has WVW in Gekozen, first, and counts two', () => {
		expect(chosen(`netwerk=${CBB}`, focusIn(link))).toEqual([WVW, CBB]);
		expect(networkCount(link, null)).toBe(2);
	});
	it('leads Lezer to the WVW, not to the first of netwerk=', () => {
		expect(networkHref(link)).toBe('/wetten/BWBR0006622?doek=banen&diepte=2&voorstellen=ja');
	});
});

describe('metLezer', () => {
	it('leaves one bron alone: it is drawn as itself, not composed', () => {
		expect(metLezer('', WVW)).toBe('');
	});
	it('does not name a bron twice, and keeps the order of the address', () => {
		const query = `netwerk=${CBB},${WVW}`;
		expect(metLezer(query, WVW)).toBe(query);
	});
	it('keeps what is switched off', () => {
		const out = new URLSearchParams(metLezer(`netwerk=${CBB}&uit=${CBB}`, WVW));
		expect([...parseNetwerk(out).uit]).toEqual([CBB]);
	});
	it('has nothing to add without a bron of the page', () => {
		expect(chosen(`netwerk=${CBB}`, null)).toEqual([CBB]);
	});
});

describe('lezerBron', () => {
	it('is the bron of the address, else the first chosen', () => {
		const params = (q: string) => new URLSearchParams(q);
		expect(lezerBron(params(`focus=${WVW}&netwerk=${CBB}`))).toBe(WVW);
		expect(lezerBron(params(`netwerk=${CBB},${DOSSIER}`))).toBe(CBB);
		expect(lezerBron(params(''))).toBeNull();
	});
	it('does not follow a bron marked on the canvas', () => {
		expect(lezerBron(new URLSearchParams(`netwerk=${CBB},${DOSSIER}&kies=${DOSSIER}`))).toBe(CBB);
	});
});

describe('× on a chosen bron', () => {
	it('of the lezer: the lezer goes along to the next one', () => {
		const stap = naWeghalen(net(WVW, CBB, DOSSIER), WVW, WVW);
		expect(stap).toMatchObject({ naar: CBB, lezen: false });
		expect(stap.netwerk.ids).toEqual([CBB, DOSSIER]);
	});
	it('of the lezer with one other left: that one alone, no netwerk', () => {
		const stap = naWeghalen(net(WVW, CBB), WVW, WVW);
		expect(stap).toMatchObject({ naar: CBB, lezen: false });
		expect(stap.netwerk.ids).toEqual([]);
	});
	it('another one: the lezer stays', () => {
		const stap = naWeghalen(net(WVW, CBB, DOSSIER), DOSSIER, WVW);
		expect(stap).toMatchObject({ naar: null, lezen: false });
		expect(stap.netwerk.ids).toEqual([WVW, CBB]);
	});
	it("another one, leaving the page's bron alone: no netwerk", () => {
		expect(naWeghalen(net(WVW, CBB), CBB, WVW).netwerk.ids).toEqual([]);
	});
	it('the last one: the netwerk is empty and the page is its text', () => {
		expect(naWeghalen(net(), WVW, WVW)).toMatchObject({ lezen: true, naar: null });
		const stap = naWeghalen(net(WVW), WVW, null);
		expect(stap).toMatchObject({ lezen: true, naar: null });
		expect(stap.netwerk.ids).toEqual([]);
	});
	it('without a bron of the page: the first chosen is the lezer, and the address follows', () => {
		const stap = naWeghalen(net(CBB, DOSSIER), CBB, null);
		expect(stap).toMatchObject({ naar: DOSSIER, lezen: false });
		expect(stap.netwerk.ids).toEqual([DOSSIER]);
	});
	it('drops what is switched off with the bron', () => {
		const stap = naWeghalen({ ids: [WVW, CBB, DOSSIER], uit: new Set([CBB]) }, CBB, WVW);
		expect([...stap.netwerk.uit]).toEqual([]);
	});
});
