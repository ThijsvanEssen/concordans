import { describe, expect, it } from 'vitest';
import { countCanvas, sameIds, type CountNode } from './canvas-count';

const node = (over: Partial<CountNode>): CountNode => ({
	drawClass: 'document',
	collection: 'documents',
	stuksoort: null,
	rechter: null,
	date: null,
	anchor: false,
	...over
});
const stuk = () => node({ filterGroup: 'stukken', vorm: 'stuk' });

/** A focus, a stuk in the chosen years, one before them, and one in a dossier switched off. */
function canvas() {
	return {
		nodes: new Map([
			['f', stuk()],
			['in', stuk()],
			['voor', stuk()],
			['dossier', stuk()]
		]),
		edges: [
			{ source: 'in', target: 'f', relation: 'REFERS_TO' as const },
			{ source: 'voor', target: 'f', relation: 'REFERS_TO' as const }
		]
	};
}

const count = (drawn: string[]) =>
	countCanvas({
		...canvas(),
		drawn: new Set(drawn),
		selectionId: 'f',
		hiddenKinds: new Set(),
		rechter: null,
		verborgen: new Map([['dossier', 'dossier' as const]]),
		hiddenLines: new Set()
	});

describe('countCanvas', () => {
	it('counts what the canvas draws: a bron outside the years is not in the Legenda', () => {
		const { counts, drawnIds } = count(['f', 'in']);
		expect(counts.nodes).toBe(2);
		expect(counts.edges).toBe(1);
		expect(counts.vormen).toEqual({ stuk: 2 });
		expect(drawnIds).toEqual(['f', 'in']);
	});

	it('counts every kind before the filter, and what a grouping switched off hides', () => {
		const { counts } = count(['f', 'in']);
		expect(counts.kinds).toEqual({ stukken: 4 });
		expect(counts.metGroep).toEqual({ stukken: { count: 1, van: 4, groepen: ['dossier'] } });
	});

	it('counts per kind what is drawn now, a ring drawn now too (B116)', () => {
		const ring = { filterGroup: 'dossiers' as const };
		const { counts } = countCanvas({
			...canvas(),
			drawn: new Set(['f', 'in']),
			selectionId: 'f',
			hiddenKinds: new Set(),
			rechter: null,
			verborgen: new Map(),
			hiddenLines: new Set(),
			rings: [ring, ring],
			ringsShown: []
		});
		expect(counts.kinds).toEqual({ stukken: 4, dossiers: 2 });
		expect(counts.drawnKinds).toEqual({ stukken: 2 });
	});
});

describe('sameIds', () => {
	it('tells the same drawn bronnen in another order from a change', () => {
		expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(true);
		expect(sameIds(['a', 'b'], ['a', 'c'])).toBe(false);
		expect(sameIds(['a'], ['a', 'b'])).toBe(false);
	});
});

describe('countCanvas, the period', () => {
	it('counts per kind what stands inside the years, and every bron without a date', () => {
		const nodes = new Map([
			['a', node({ filterGroup: 'uitspraken', date: '2012-05-01' })],
			['b', node({ filterGroup: 'uitspraken', date: '2020-05-01' })],
			['c', node({ filterGroup: 'artikelen' })]
		]);
		const { counts } = countCanvas({
			nodes,
			edges: [],
			drawn: new Set(['a', 'b', 'c']),
			selectionId: null,
			hiddenKinds: new Set(),
			rechter: null,
			period: { from: '2011-01-01', to: '2016-12-31' },
			verborgen: new Map(),
			hiddenLines: new Set()
		});
		expect(counts.kinds).toEqual({ uitspraken: 1, artikelen: 1 });
	});
});

describe('a commissie drawn as a ring (B41)', () => {
	it('is one bron of its soort, with no point of its own', () => {
		const { counts } = countCanvas({
			...canvas(),
			drawn: new Set(['f', 'in']),
			selectionId: 'f',
			hiddenKinds: new Set(),
			rechter: null,
			verborgen: new Map(),
			hiddenLines: new Set(),
			rings: [{ filterGroup: 'commissies' }]
		});
		expect(counts.kinds).toEqual({ stukken: 4, commissies: 1 });
	});
});
