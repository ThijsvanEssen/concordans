import { describe, expect, it } from 'vitest';
import { edgesByNode, mostCommonRelation, neighbours, pushTo } from './adjacency';

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

describe('mostCommonRelation', () => {
	it('is the relation most members have with the end, and its way', () => {
		const edges = [
			edge('m1', 'f', 'REFERS_TO'),
			edge('m2', 'f', 'REFERS_TO'),
			edge('f', 'm3', 'CITES')
		];
		const ties = edgesByNode(edges);
		expect(mostCommonRelation(new Set(['m1', 'm2', 'm3']), ties, 'f')).toEqual({
			relation: 'REFERS_TO',
			toEnd: true
		});
	});

	it('runs from the end when most edges start there', () => {
		const edges = [edge('f', 'm1', 'AMENDS'), edge('f', 'm2', 'AMENDS'), edge('m3', 'f')];
		expect(mostCommonRelation(new Set(['m1', 'm2', 'm3']), edgesByNode(edges), 'f')).toEqual({
			relation: 'AMENDS',
			toEnd: false
		});
	});

	it('counts only edges to the end', () => {
		const edges = [edge('m1', 'other', 'AMENDS'), edge('m1', 'other', 'AMENDS'), edge('m1', 'f')];
		expect(mostCommonRelation(new Set(['m1']), edgesByNode(edges), 'f').relation).toBe('REFERS_TO');
	});

	it('is RELATED_TO toward the end without an edge to it', () => {
		expect(mostCommonRelation(new Set(['m1']), new Map(), 'f')).toEqual({
			relation: 'RELATED_TO',
			toEnd: true
		});
	});
});
