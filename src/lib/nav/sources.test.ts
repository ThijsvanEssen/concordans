import { describe, expect, it } from 'vitest';
import { sourceOf, sourceOfCollection, SOURCES } from './sources';
import { networkCount, networkHref, onNetwork } from './network';
import { mineAt } from './mine';

const at = (path: string) => new URL(path, 'https://concordans.nl');

describe('the source a page stands under', () => {
	it('names the list of Bladeren by its kind', () => {
		expect(sourceOf(at('/explore?mode=index&kind=instruments'))?.id).toBe('wetten');
		expect(sourceOf(at('/explore?mode=index&kind=judgments'))?.id).toBe('uitspraken');
		expect(sourceOf(at('/explore?mode=index&kind=decisions'))?.id).toBe('kamerstukken');
		expect(sourceOf(at('/explore?mode=index&kind=factions'))?.id).toBe('parlement');
		expect(sourceOf(at('/explore?mode=index&kind=ministers'))?.id).toBe('regering');
		expect(sourceOf(at('/explore?mode=index'))).toBeNull();
	});

	it('names a bron read by its address or its focus', () => {
		expect(sourceOf(at('/wetten/BWBR0005289/artikel/6:162'))?.id).toBe('wetten');
		expect(sourceOf(at('/stb/2026/94'))?.id).toBe('wetten');
		expect(sourceOf(at('/uitspraken/ECLI:NL:HR:2019:2006'))?.id).toBe('uitspraken');
		expect(sourceOf(at('/kamerstukken/36799/31'))?.id).toBe('kamerstukken');
		expect(sourceOf(at('/leden/rob-jetten'))?.id).toBe('parlement');
		expect(sourceOf(at('/toezeggingen/TZ202609-124'))?.id).toBe('regering');
		expect(sourceOf(at('/explore?focus=judgments/ecli_nl_hr_2019_2006'))?.id).toBe('uitspraken');
	});

	it('names none for the start page, Actueel, Mijn and a canvas without a bron', () => {
		for (const path of ['/', '/actueel', '/bundels', '/onderwerpen', '/explore'])
			expect(sourceOf(at(path)), path).toBeNull();
	});

	it('gives every kind of bron a source', () => {
		expect(sourceOfCollection('articles').id).toBe('wetten');
		expect(sourceOfCollection('cabinets').id).toBe('regering');
		expect(SOURCES.map((s) => s.label)).toEqual([
			'Wetten',
			'Rechtspraak',
			'Kamerstukken',
			'Parlement',
			'Regering'
		]);
	});
});

describe('the Netwerk button', () => {
	it('opens the bron of the page big, and elsewhere begins with choosing', () => {
		const article = '/wetten/BWBR0005289/artikel/6:162';
		expect(networkHref(at(article))).toBe(`${article}?mode=netwerk`);
		expect(networkHref(at(`${article}?toon=netwerk&lid=2`))).toBe(`${article}?lid=2&mode=netwerk`);
		// A switch: from the werkplek back to the text, the place in it kept (Thijs, 23 Oct).
		expect(networkHref(at(`${article}?mode=netwerk&netwerk=articles/a&kies=x#lid-2`))).toBe(
			`${article}#lid-2`
		);
		expect(networkHref(at('/explore?netwerk=articles/a,articles/b&kies=articles/b'))).toBe(
			'/explore?focus=articles%2Fb'
		);
		expect(networkHref(at('/explore?netwerk=articles/a'))).toBe('/explore?focus=articles%2Fa');
		expect(networkHref(at('/explore'))).toBe('/');
		// The netwerk the reader composed stands in the address; a bron alone stays alone.
		expect(networkHref(at(article), 'netwerk=articles%2Fa&uit=members%2Fx')).toBe(
			`${article}?mode=netwerk&netwerk=articles%2Fa&uit=members%2Fx`
		);
		expect(networkHref(at('/'))).toBe('/explore');
		expect(networkHref(at('/explore?mode=index&kind=instruments'))).toBe('/explore');
		expect(networkHref(at('/actueel'))).toBe('/explore');
	});

	it('stands pressed on the canvas, with a bron or without', () => {
		expect(onNetwork(at('/explore'))).toBe(true);
		expect(onNetwork(at('/wetten/BWBR0005289/artikel/6:162?mode=netwerk'))).toBe(true);
		expect(onNetwork(at('/wetten/BWBR0005289/artikel/6:162'))).toBe(false);
		expect(onNetwork(at('/explore?mode=index'))).toBe(false);
	});

	it("counts the werkplek's own netwerk there, the kept one elsewhere", () => {
		expect(networkCount(at('/explore?netwerk=articles/a,articles/b'), 5)).toBe(2);
		expect(networkCount(at('/wetten/BWBR0005289/artikel/6:162'), 3)).toBe(3);
		expect(networkCount(at('/actueel'), 0)).toBe(0);
	});
});

describe('Mijn', () => {
	it('names Bundels and Gevolgd by their pages', () => {
		expect(mineAt('/bundels')).toBe('bundels');
		expect(mineAt('/bundels/k3j2')).toBe('bundels');
		expect(mineAt('/onderwerpen/overzicht')).toBe('gevolgd');
		expect(mineAt('/actueel')).toBeNull();
	});
});
