import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { apiDocs } from './docs';

const spec = {
	info: { version: '1.2.3' },
	paths: {
		'/api/b': {
			get: {
				tags: ['judgments'],
				summary: 'B',
				description: 'Read b.',
				operationId: 'get_b',
				parameters: [
					{ name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
					{
						name: 'ecli',
						in: 'path',
						required: true,
						description: 'The ECLI.',
						schema: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Unused.' }
					},
					{ name: 'kind', in: 'query', schema: { type: 'array', items: { type: 'string' } } },
					{ name: 'q', in: 'query', schema: { description: 'Words.' } }
				],
				responses: {
					'200': {
						description: 'OK',
						content: {
							'application/json': {
								schema: { type: 'array', items: { $ref: '#/components/schemas/Judgment' } }
							}
						}
					},
					'404': { description: 'Not found' }
				}
			},
			post: { tags: ['judgments'], summary: 'not a GET' }
		},
		'/api/a': { get: { responses: { '200': { content: { 'application/json': {} } } } } }
	}
};

describe('apiDocs', () => {
	it('takes the GET routes with their text, parameters and answers, sorted by path', () => {
		expect(apiDocs(spec)).toEqual({
			version: '1.2.3',
			endpoints: [
				{
					tag: 'root',
					method: 'GET',
					path: '/api/a',
					summary: '',
					description: '',
					parameters: [],
					responses: [{ status: '200', description: '', schema: null }],
					operationId: 'get-/api/a'
				},
				{
					tag: 'judgments',
					method: 'GET',
					path: '/api/b',
					summary: 'B',
					description: 'Read b.',
					parameters: [
						{
							name: 'limit',
							in: 'query',
							type: 'integer',
							required: false,
							description: '',
							default: '20'
						},
						{
							name: 'ecli',
							in: 'path',
							type: 'string',
							required: true,
							description: 'The ECLI.',
							default: null
						},
						{
							name: 'kind',
							in: 'query',
							type: 'string[]',
							required: false,
							description: '',
							default: null
						},
						{
							name: 'q',
							in: 'query',
							type: 'any',
							required: false,
							description: 'Words.',
							default: null
						}
					],
					responses: [
						{ status: '200', description: 'OK', schema: 'Judgment[]' },
						{ status: '404', description: 'Not found', schema: null }
					],
					operationId: 'get_b'
				}
			]
		});
	});
});

describe('/api in the bundle', () => {
	it('reads the routes from virtual:api-docs, not the whole schema', () => {
		const page = readFileSync('src/routes/(main)/api/+page.ts', 'utf8');
		expect(page).toContain("from 'virtual:api-docs'");
		expect(page).not.toContain('openapi.json');
	});
});
