import { describe, expect, it } from 'vitest';
import { BRONNEN, bron } from '$lib/test/bronnen';
import type { Gedeeld, MapItem } from './map';
import { BROKEN, isOldLink, shareFragment, sharedOfFragment } from './share';

const lid2: MapItem = {
	id: 'articles/bwbr0005289_162',
	at: 'lid-2',
	kort: 'art. 6:162 lid 2 BW',
	voluit: 'artikel 6:162 lid 2 Burgerlijk Wetboek',
	groep: 'Burgerlijk Wetboek Boek 6',
	groupKey: 'wet:bwbr0005289',
	notitie: 'Drie categorieën; ~ en ; en # en & erin',
	pad: '/wetten/BWBR0005289/artikel/6:162'
};
const ro: MapItem = {
	id: 'judgments/ecli_nl_hr_2019_2006',
	at: 'rov-5.7.1',
	kort: 'HR 20 december 2019, ECLI:NL:HR:2019:2006, r.o. 5.7.1',
	groep: 'HR 20 december 2019 (Urgenda)',
	groupKey: 'judgments/ecli_nl_hr_2019_2006'
};
const map = {
	naam: 'Aansprakelijkheid werkgever',
	items: [lid2, ro],
	volgorde: 'eigen' as const,
	notitie: 'Vraag: valt een RSI-klacht bij thuiswerk onder 7:658 BW?',
	groepNotities: { 'wet:bwbr0005289': 'De onrechtmatige daad', 'wet:bwbr0000000': 'weg' }
};

/** The link as the page copies it. */
const linkOf = async (m: typeof map) =>
	new URL(`/gemarkeerd${await shareFragment(m)}`, 'https://concordans.nl');

describe('the link of a map', () => {
	it('carries the map in its fragment and comes back the same', async () => {
		const url = await linkOf(map);
		expect(url.hash).toMatch(/^#m=[\w-]+$/);
		expect(await sharedOfFragment(url.hash)).toEqual({
			naam: map.naam,
			items: [lid2, ro],
			volgorde: 'eigen',
			notitie: map.notitie,
			groepNotities: { 'wet:bwbr0005289': 'De onrechtmatige daad' },
			skipped: 0
		});
	});

	it('sends nothing of the map with a request: no query, no words before the fragment', async () => {
		const url = await linkOf(map);
		// What a request carries: the address without its fragment.
		const sent = url.href.slice(0, url.href.indexOf('#'));
		expect(sent).toBe('https://concordans.nl/gemarkeerd');
		expect(url.search).toBe('');
		// And the fragment itself is no readable text: deflated, in base64url.
		for (const word of ['Drie', 'RSI', 'Aansprakelijkheid', 'bwbr0005289', 'Urgenda'])
			expect(url.hash).not.toContain(word);
	});

	it('is shorter deflated than as text', async () => {
		const many = {
			...map,
			items: Array.from({ length: 30 }, (_, n) => ({ ...lid2, at: `lid-${n}` }))
		};
		const hash = await shareFragment(many);
		expect(hash.length).toBeLessThan(JSON.stringify(many).length / 3);
	});

	it('reads no map from another fragment, and says a cut or broken one is (UX 16 Oct #1)', async () => {
		expect(await sharedOfFragment('')).toBeNull();
		expect(await sharedOfFragment('#lid-2')).toBeNull();
		expect(await sharedOfFragment('#m=nonsense')).toBe(BROKEN);
		expect(await sharedOfFragment('#m=abc!!def')).toBe(BROKEN);
		expect(await sharedOfFragment('#m=')).toBe(BROKEN);
		const whole = await shareFragment(map);
		expect(await sharedOfFragment(whole.slice(0, Math.round(whole.length * 0.6)))).toBe(BROKEN);
	});

	it('knows a link of the older form, in the query (UX 16 Oct #2)', () => {
		expect(isOldLink(new URLSearchParams('map=articles/bwbr0005289_162'))).toBe(true);
		expect(isOldLink(new URLSearchParams('mapnaam=x'))).toBe(true);
		expect(isOldLink(new URLSearchParams('q=x'))).toBe(false);
	});

	it('leaves out an item in a broken form, and counts it for the page', async () => {
		const broken = { ...ro, groupKey: '' };
		const shared = (await sharedOfFragment(
			await shareFragment({ ...map, items: [lid2, broken] })
		)) as Gedeeld;
		expect(shared?.items).toEqual([lid2]);
		expect(shared?.skipped).toBe(1);
	});

	it('is never put in the query: no page writes or reads ?map=', () => {
		const query =
			/[?&]map=|searchParams\.(?:get|has)\('map(?:naam|notitie|groepen|volgorde)?'\)|\bmapParams\(/;
		expect(BRONNEN.filter(({ text }) => query.test(text)).map((s) => s.path)).toEqual([]);
		expect(bron('routes/(main)/gemarkeerd/+page.svelte')).toContain('shareFragment(');
	});
});
