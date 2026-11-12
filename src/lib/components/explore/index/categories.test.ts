import { describe, expect, it } from 'vitest';
import { SOURCES } from '$lib/nav/sources';
import { sourceTabs } from './categories';

const of = (id: string) => SOURCES.find((s) => s.id === id)!;

describe('the tabs of a source', () => {
	it('are its lists, each with its glyph, then its pages without one', () => {
		const tabs = sourceTabs(of('rechtspraak'));
		expect(tabs.map((t) => [t.label, t.href, t.shape])).toEqual([
			['Uitspraken', '/uitspraken', 'uitspraak'],
			['Rechtsgang', '/rechtspraak/rechtsgang', undefined]
		]);
		expect(tabs[1].about).toBeTruthy();
	});

	it('give Regering its offices after Ministeries, large to small', () => {
		expect(sourceTabs(of('regering')).map((t) => t.label)).toEqual([
			'Kabinetten',
			'Ministeries',
			'Ambten',
			'Bewindspersonen'
		]);
	});

	it('take the address of a list from the caller (IndexView keeps the Kamer)', () => {
		const tabs = sourceTabs(of('parlement'), (k) => `/${k}?kamer=EK`);
		expect(tabs.map((t) => t.href)).toEqual([
			'/members?kamer=EK',
			'/factions?kamer=EK',
			'/committees?kamer=EK'
		]);
	});

	it('are none for a source of one list and no page', () => {
		expect(sourceTabs(of('wetten'))).toEqual([]);
	});
});
