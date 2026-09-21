import { describe, expect, it } from 'vitest';
import { NODE_TYPES, RELATIONS, type Collection } from '$lib/vocabulary';
import {
	EDGE_WEIGHT,
	buildNodeLabel,
	edgeCategory,
	kindOfCollection,
	nodeToGraphNode,
	relationOf,
	type BaseNode
} from './types';

const node = (collection: string, key: string, props: BaseNode['props'] = {}): BaseNode => ({
	id: `${collection}/${key}`,
	key,
	collection,
	type: 'x',
	display_name: null,
	labels: [],
	props
});

describe('relations', () => {
	it('gives every relation a weight', () => {
		expect(Object.keys(EDGE_WEIGHT).sort()).toEqual([...RELATIONS].sort());
	});

	it('reads REFERS_TO by the kind of its source', () => {
		expect(edgeCategory('REFERS_TO', 'article')).toBe('structural');
		expect(edgeCategory('REFERS_TO', 'judgment')).toBe('semantic');
		expect(edgeCategory('REFERS_TO', 'document')).toBe('semantic');
	});

	it('counts proposed and enacted changes as mutations', () => {
		for (const relation of ['AMENDS', 'INTRODUCES', 'REPEALS'] as const) {
			expect(edgeCategory(relation, 'document')).toBe('mutation');
		}
	});

	it('refuses a relation of the old API', () => {
		expect(relationOf('REFERS_TO_ARTICLE')).toBeNull();
		expect(relationOf('PART_OF')).toBe('PART_OF');
	});
});

describe('node kinds', () => {
	it('gives every collection a kind', () => {
		for (const collection of Object.keys(NODE_TYPES) as Collection[]) {
			expect(kindOfCollection(collection)).toBeTruthy();
		}
	});

	it('drops a node of an unknown collection', () => {
		expect(nodeToGraphNode(node('commissies', 'x'))).toBeNull();
		expect(nodeToGraphNode(node('committees', 'x'))?.kind).toBe('committee');
	});
});

describe('node labels', () => {
	it('shortens a dossier title to the name of the act', () => {
		const label = buildNodeLabel(
			node('dossiers', '36600', {
				number: '36600',
				title: 'Wijziging van de Wet X (Wet verbetering aanpak Y)'
			}),
			'dossier'
		);
		expect(label).toBe('36600 · Wet verbetering aanpak Y');
	});

	it('labels an article and a judgment', () => {
		expect(buildNodeLabel(node('articles', 'a', { article_number: '287' }), 'article')).toBe(
			'Art. 287'
		);
		expect(
			buildNodeLabel(node('judgments', 'j', { ecli: 'ECLI:NL:HR:2023:456' }), 'judgment')
		).toBe('HR 2023/456');
	});

	it('names a motion after its lead signatory', () => {
		const label = buildNodeLabel(
			node('documents', 'd', {
				kind: 'Motie',
				date: '2026-01-02',
				actors: [
					{ name: 'A. Jansen', faction: 'VVD', role: 'Medeindiener' },
					{ name: 'B. de Vries', faction: 'D66', role: 'Eerste indiener' }
				]
			}),
			'document'
		);
		expect(label).toBe('Motie-Vries (D66)');
	});

	it('labels a member with the party', () => {
		expect(
			buildNodeLabel(node('members', 'm', { name: 'Jan Jansen', party: 'VVD' }), 'member')
		).toBe('Jan Jansen (VVD)');
	});
});
