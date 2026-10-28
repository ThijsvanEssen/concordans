import { describe, expect, it } from 'vitest';
import { citeItems } from './cite-items';

describe('citeItems', () => {
	it('lists the forms in one order, the link last, and leaves out what is missing', () => {
		expect(
			citeItems(
				{
					kort: 'art. 6:162 BW',
					voluit: 'artikel 6:162 van het Burgerlijk Wetboek',
					metDatum: 'x'
				},
				'https://concordans.nl/explore?focus=articles/bwbr0005289_162&lezen=1'
			).map((i) => i.kind)
		).toEqual(['kort', 'voluit', 'met datum', 'link']);
		expect(citeItems({ kort: 'HR 2019/1278, r.o. 4.2' }, null).map((i) => i.kind)).toEqual([
			'kort'
		]);
		expect(citeItems(null, null)).toEqual([]);
	});

	it('shows the link without lezen=1, and copies it with', () => {
		const link = (u: string) => citeItems(null, u)[0];
		const a = link('https://concordans.nl/explore?focus=articles/x_1&lezen=1#lid-2');
		expect(a.text).toContain('&lezen=1');
		expect(a.shown).toBe('https://concordans.nl/explore?focus=articles/x_1#lid-2');
		expect(link('https://c.nl/wetten/x?lezen=1').shown).toBe('https://c.nl/wetten/x');
		expect(link('https://c.nl/wetten/x?lezen=1&b=2').shown).toBe('https://c.nl/wetten/x?b=2');
		expect(link('https://c.nl/wetten/x?b=2').shown).toBe('https://c.nl/wetten/x?b=2');
	});
});
