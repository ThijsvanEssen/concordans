import { describe, expect, it } from 'vitest';
import type { ChainLayer, ChainNode } from './chain';
import { liftsOf, widthOf } from './chain-room';

const node = (id: string, parents: ChainNode['parents'] = []) => ({ id, parents }) as ChainNode;
const layer = (id: ChainLayer['id'], nodes: ChainNode[]) =>
	({ id, label: id, nodes }) as ChainLayer;
const cite = { full: 'art. 1', count: 1 } as never;

describe('the room of the layers of the keten', () => {
	const room = { left: 120, slot: 192 };

	it('asks a slot for each bron and for "N andere", at least what there is', () => {
		const amvb = layer('amvb', [node('a'), node('b')]);
		expect(widthOf([amvb], {}, 100, room)).toBe(144 + 2 * 192);
		expect(widthOf([amvb], { amvb: 5 }, 100, room)).toBe(144 + 3 * 192);
		expect(widthOf([amvb], {}, 2000, room)).toBe(2000);
	});

	it('lowers a row by the labels stacked over one bron, not those beside it', () => {
		const way = 'delegates' as const;
		const one = layer('amvb', [node('a', [{ id: 'law', way, cite }])]);
		const two = layer('kb', [
			node('b', [
				{ id: 'law', way, cite },
				{ id: 'wet', way: 'mentioned', cite }
			])
		]);
		const beside = layer('law', [
			node('law'),
			node('c', [
				{ id: 'law', way, cite },
				{ id: 'law', way: 'mentioned', cite }
			])
		]);
		const noCite = layer('other', [
			node('d', [
				{ id: 'law', way },
				{ id: 'wet', way }
			])
		]);
		expect(liftsOf([one, two, beside, noCite], 24)).toEqual([0, 24, 0, 0]);
	});
});
