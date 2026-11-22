import { describe, expect, it } from 'vitest';
import { edgesByNode, neighbours, pushTo } from './adjacency';

const edge = (source: string, target: string, relation = 'REFERS_TO') => ({
	source,
	target,
	relation
});

describe('pushTo', () => {
	it('starts a list for a new key and adds to it after', () => {
		const m = new Map<string, number[]>();
		pushTo(m, 'a', 1);
		pushTo(m, 'a', 2);
		expect(m.get('a')).toEqual([1, 2]);
	});
});

describe('neighbours', () => {
	it('lists what an edge ties a node to, either way', () => {
		const next = neighbours([edge('a', 'b'), edge('c', 'a')]);
		expect(next.get('a')).toEqual(['b', 'c']);
		expect(next.get('b')).toEqual(['a']);
		expect(next.get('c')).toEqual(['a']);
	});
});

describe('edgesByNode', () => {
	it('gives every node the edges that touch it', () => {
		const ab = edge('a', 'b');
		const bc = edge('b', 'c');
		const ties = edgesByNode([ab, bc]);
		expect(ties.get('b')).toEqual([ab, bc]);
		expect(ties.get('a')).toEqual([ab]);
	});
});
