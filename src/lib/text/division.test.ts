import { describe, expect, it } from 'vitest';
import { layersOf, placeOf } from './division';

const awb34 = [
	{ type: 'hoofdstuk', label: 'Hoofdstuk 3', title: 'Algemene bepalingen over besluiten' },
	{ type: 'afdeling', label: 'Afdeling 3.2', title: 'Zorgvuldigheid en belangenafweging' }
];
const bw162 = [
	{ type: 'boek', label: 'Boek 6', title: 'Algemeen gedeelte van het verbintenissenrecht' },
	{ type: 'titeldeel', label: 'Titel 3', title: 'Onrechtmatige daad' },
	{ type: 'afdeling', label: 'Afdeling 1', title: 'Algemene bepalingen' }
];

describe('layersOf', () => {
	it('drops a first layer that is the law itself', () => {
		expect(layersOf(bw162, 'Burgerlijk Wetboek Boek 6').map((c) => c.label)).toEqual([
			'Titel 3',
			'Afdeling 1'
		]);
	});
	it('keeps every layer of a law that is not a book', () => {
		expect(layersOf(awb34, 'Algemene wet bestuursrecht')).toHaveLength(2);
	});
	it('does not take Boek 6 for Boek 61', () => {
		expect(layersOf(bw162, 'Wet Boek 61')).toHaveLength(3);
	});
});

describe('placeOf', () => {
	it('names every layer once, the innermost with its heading', () => {
		expect(placeOf(awb34, 'Algemene wet bestuursrecht')).toEqual({
			designation: 'Hoofdstuk 3, afdeling 3.2',
			title: 'Zorgvuldigheid en belangenafweging'
		});
	});
	it('leaves out the book of a BW book', () => {
		expect(placeOf(bw162, 'Burgerlijk Wetboek Boek 6')).toEqual({
			designation: 'Titel 3, afdeling 1',
			title: 'Algemene bepalingen'
		});
	});
	it('is short for an article of a bijlage', () => {
		const crumbs = [
			{
				type: 'bijlage',
				label: 'Bijlage 2',
				title: 'Bevoegdheidsregeling bestuursrechtspraak (artikelen 8:5, 8:6, 8:7, 8:105 en 8:106)'
			},
			{ type: 'hoofdstuk', label: 'Hoofdstuk 2', title: 'Beroep in eerste aanleg' }
		];
		expect(placeOf(crumbs, 'Algemene wet bestuursrecht')).toEqual({
			designation: 'Bijlage 2, hoofdstuk 2',
			title: 'Beroep in eerste aanleg'
		});
	});
	it('is null without a layer', () => {
		expect(placeOf([], 'Grondwet')).toBeNull();
	});
});
