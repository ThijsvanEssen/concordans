import { describe, expect, it } from 'vitest';
import { foldVersions } from './paths';

describe('foldVersions', () => {
	it('folds a hop through an article version onto the article', () => {
		const nodes = [
			{ collection: 'members', key: 'voortman' },
			{ collection: 'documents', key: 'mvt' },
			{ collection: 'article_versions', key: 'awb_3_7_2022' },
			{ collection: 'articles', key: 'awb_3_7' }
		];
		const edges = [
			{ id: 'e1', source: 'members/voortman', target: 'documents/mvt', relation: 'AUTHORED' },
			{
				id: 'e2',
				source: 'documents/mvt',
				target: 'article_versions/awb_3_7_2022',
				relation: 'EXPLAINS'
			},
			{
				id: 'e3',
				source: 'article_versions/awb_3_7_2022',
				target: 'articles/awb_3_7',
				relation: 'VERSION_OF'
			}
		];
		const folded = foldVersions(nodes, edges);
		expect(folded.nodes.map((n) => n.key)).toEqual(['voortman', 'mvt', 'awb_3_7']);
		expect(folded.edges).toEqual([
			edges[0],
			{ id: 'e2', source: 'documents/mvt', target: 'articles/awb_3_7', relation: 'EXPLAINS' }
		]);
	});

	it('leaves a path without versions as it is', () => {
		const nodes = [{ collection: 'members', key: 'a' }];
		const edges = [{ id: 'e', source: 'members/a', target: 'documents/b', relation: 'AUTHORED' }];
		expect(foldVersions(nodes, edges)).toEqual({ nodes, edges });
	});
});
