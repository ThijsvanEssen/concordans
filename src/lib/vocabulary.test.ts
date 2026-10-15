import { describe, expect, it } from 'vitest';
import {
	AMENDING_RELATIONS,
	CHANGE_RELATIONS,
	NODE_TYPES,
	RELATIONS,
	changeRelation,
	changeRelationOf,
	isAmendingRelation,
	isChangeRelation,
	isCollection,
	isRelation,
	nodeId,
	parseNodeId
} from './vocabulary';
import catalogus from '$lib/api/relations.json';
import openapi from '$lib/api/openapi.json';

describe('node ids', () => {
	it('builds and parses collection/key', () => {
		expect(nodeId('articles', 'bwbr0001854_287')).toBe('articles/bwbr0001854_287');
		expect(parseNodeId('dossiers/29684_i')).toEqual({ collection: 'dossiers', key: '29684_i' });
	});

	it('keeps a slash inside the key', () => {
		expect(parseNodeId('documents/a/b')).toEqual({ collection: 'documents', key: 'a/b' });
	});

	it.each(['articles', 'articles/', '/x', 'kamerstukdossiers/29684', 'instrument_articles/x', ''])(
		'refuses %j',
		(id) => expect(parseNodeId(id)).toBeNull()
	);
});

describe('vocabulary', () => {
	it('knows the collections and relations of the API catalogue, each once', () => {
		expect(Object.keys(NODE_TYPES).sort()).toEqual([...catalogus.collections].sort());
		expect([...RELATIONS].sort()).toEqual(catalogus.relations.map((r) => r.name).sort());
		expect(new Set(RELATIONS).size).toBe(RELATIONS.length);
	});

	it('has the catalogue the API types its schema with', () => {
		const schemas = openapi.components.schemas;
		expect([...catalogus.collections].sort()).toEqual(
			[...schemas.BaseNodeDTO.properties.collection.enum].sort()
		);
		expect(catalogus.relations.map((r) => r.name).sort()).toEqual(
			[...schemas.NodeNeighborhoodEdge.properties.relation.anyOf[0].enum!].sort()
		);
	});

	it('refuses names of the old API', () => {
		expect(isCollection('commissies')).toBe(false);
		expect(isCollection('committees')).toBe(true);
		expect(isRelation('REFERS_TO_ARTICLE')).toBe(false);
		expect(isRelation('MEMBER_OF')).toBe(true);
		expect(isRelation(null)).toBe(false);
	});

	it('is not fooled by properties of Object', () => {
		expect(isCollection('toString')).toBe(false);
		expect(isCollection('constructor')).toBe(false);
	});
});

describe('the changes of the law', () => {
	it('lists the four changes once, in the order a line names them', () => {
		expect(CHANGE_RELATIONS).toEqual(['ESTABLISHES', 'AMENDS', 'INTRODUCES', 'REPEALS']);
		// A bill or a publication changes a law that exists; enacting a new one is not among them.
		expect(AMENDING_RELATIONS).toEqual(['AMENDS', 'INTRODUCES', 'REPEALS']);
		expect(isChangeRelation('ESTABLISHES')).toBe(true);
		expect(isChangeRelation('REFERS_TO')).toBe(false);
		expect(isAmendingRelation('ESTABLISHES')).toBe(false);
		expect(isAmendingRelation('REPEALS')).toBe(true);
		expect(isAmendingRelation(null)).toBe(false);
	});

	it('reads a change as the API writes it, `amends`, as its relation', () => {
		expect(changeRelation('repeals')).toBe('REPEALS');
		expect(changeRelationOf('establishes')).toBe('ESTABLISHES');
		expect(changeRelationOf('legislated_in')).toBeNull();
		expect(changeRelationOf(null)).toBeNull();
	});
});
