import { afterEach, describe, expect, it, vi } from 'vitest';
import { herkend, padVan, verwijzingenIn, zoekVerwijzingen } from './verwijzingen';

const lookup = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/search', () => ({ lookup }));

afterEach(() => lookup.mockReset());

describe('verwijzingenIn', () => {
	it('reads an article of the BW with its book, and its lid', () => {
		const [art, lid] = verwijzingenIn('op grond van art. 6:162 BW en Art. 6:162 lid 2 BW:');
		expect(art).toMatchObject({ tekst: 'art. 6:162 BW', pad: '/wetten/BWBR0005289/artikel/6:162' });
		expect(lid).toMatchObject({
			sleutel: 'artikel 6:162 lid 2 bw',
			pad: '/wetten/BWBR0005289/artikel/6:162#lid-2'
		});
	});

	it('asks another law by its abbreviation', () => {
		const [v] = verwijzingenIn('zie artikel 8 Wiv 2017.');
		expect(v).toMatchObject({
			tekst: 'artikel 8 Wiv 2017',
			pad: null,
			vraag: { law: 'Wiv 2017', number: '8', lid: null }
		});
	});

	it('reads an ECLI and a Kamerstuk', () => {
		expect(
			verwijzingenIn(
				'HR in ECLI:NL:HR:1965:AB7079, en Kamerstukken II 2016/17, 34588, nr. 3 (MvT)'
			).map((v) => v.pad)
		).toEqual(['/uitspraken/ECLI:NL:HR:1965:AB7079', '/kamerstukken/34588/3']);
	});

	it('takes no word that opens a sentence for a law', () => {
		expect(verwijzingenIn('Zie artikel 3 De wet zegt')).toEqual([]);
	});

	it('names each once under the field', () => {
		expect(herkend('art. 6:162 BW, art. 6:162 BW en art. 98 Sr')).toEqual([
			'artikel 6:162 BW',
			'artikel 98 Sr'
		]);
	});
});

describe('zoekVerwijzingen', () => {
	it('asks only what the text and the bundel do not say', async () => {
		lookup.mockResolvedValue({ props: { bwb_id: 'BWBR0001854', article_number: '98' } });
		const uit = await zoekVerwijzingen('art. 98 Sr, art. 6:162 BW en art. 8 Wiv 2017', {
			'artikel 8 wiv 2017': '/wetten/BWBR0039896/artikel/8'
		});
		expect(lookup).toHaveBeenCalledTimes(1);
		expect(lookup).toHaveBeenCalledWith({ kind: 'article', law: 'Sr', number: '98' });
		expect(uit).toEqual({ 'artikel 98 sr': '/wetten/BWBR0001854/artikel/98' });
	});

	it('gives a BW article back with its book, and leaves one not found as text', async () => {
		lookup
			.mockResolvedValueOnce({ props: { bwb_id: 'BWBR0005290', article_number: '658' } })
			.mockRejectedValueOnce(new Error('404'));
		const uit = await zoekVerwijzingen('art. 658 Boek7 en art. 1 Xyz lid 2');
		expect(Object.values(uit)).toEqual(['/wetten/BWBR0005290/artikel/7:658']);
	});

	it('asks nothing for a text without such verwijzingen', async () => {
		expect(await zoekVerwijzingen('art. 6:162 BW')).toEqual({});
		expect(lookup).not.toHaveBeenCalled();
	});

	it('finds the address kept with the bundel', () => {
		const [v] = verwijzingenIn('art. 98 Sr');
		expect(padVan(v, { 'artikel 98 sr': '/wetten/BWBR0001854/artikel/98' })).toBe(
			'/wetten/BWBR0001854/artikel/98'
		);
		expect(padVan(v)).toBeNull();
	});
});
