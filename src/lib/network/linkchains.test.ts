import { describe, expect, it } from 'vitest';
import { chainsModel, countOf, chainsLabel, type ChainsResponse } from './linkchains';
import { fakeApi, slow } from '$lib/test/fakeApi';
import { getChains } from '$lib/api/nodes';
import { isTimeout } from '$lib/api/client';

const node = (id: string, collection: string, name: string) => ({
	id,
	key: id.split('/')[1],
	collection,
	type: collection,
	display_name: name,
	labels: [],
	props: {},
	kind_group: null,
	cite: null,
	title: null,
	path: null
});
const edge = (id: string, source: string, target: string, relation = 'REFERS_TO') => ({
	id,
	source,
	target,
	relation,
	confidence: null,
	status: null
});
const step = (source: string, target: string, via: string | null, edge_ids: string[]) => ({
	source,
	target,
	via,
	edge_ids,
	ways: 1
});

const A = 'instruments/a';
const B = 'instruments/b';
const C = 'instruments/c';
const D = 'instruments/d';
const X = 'documents/x';
const Y = 'documents/y';

const response = (over: Record<string, unknown> = {}) =>
	({
		ids: [A, B],
		max_steps: 3,
		limit: 12,
		blocks: [
			{ steps: 1, total: 0, complete: true, chains: [] },
			{
				steps: 2,
				total: 2,
				complete: true,
				chains: [
					{
						node_ids: [A, C, B],
						weight: 5,
						steps: [step(A, C, X, ['e1', 'e2']), step(C, B, Y, ['e3', 'e4'])]
					},
					{
						node_ids: [A, D, B],
						weight: 1,
						steps: [step(A, D, null, ['e5']), step(D, B, null, ['e6'])]
					}
				]
			},
			{
				steps: 3,
				total: 1,
				complete: true,
				chains: [
					{
						node_ids: [A, C, D, B],
						weight: 2,
						steps: [step(A, C, X, ['e1', 'e2']), step(C, D, null, ['e7']), step(D, B, null, ['e6'])]
					}
				]
			}
		],
		nodes: [
			node(A, 'instruments', 'Waterschapswet'),
			node(B, 'instruments', 'Burgerlijk Wetboek Boek 7'),
			node(C, 'instruments', 'Woningwet'),
			node(D, 'instruments', 'Gemeentewet'),
			node(X, 'documents', '35133, nr. 3'),
			node(Y, 'documents', '36496, nr. 3')
		],
		edges: [
			edge('e1', X, A),
			edge('e2', X, C),
			edge('e3', Y, C),
			edge('e4', Y, B),
			edge('e5', A, D),
			edge('e6', D, B),
			edge('e7', C, D)
		],
		capped: false,
		partial: false,
		...over
	}) as unknown as ChainsResponse;

const names = (id: string) => ({ id, name: id, collection: null });

describe('chainsModel', () => {
	it('makes a block per length from two steps, in order, with their rows', () => {
		const m = chainsModel(response(), [A, B], names);
		expect(m.blocks.map((b) => [b.title, b.rows.length])).toEqual([
			['Twee stappen', 2],
			['Drie stappen', 1]
		]);
		expect(m.none).toBe(false);
	});
	it('stops at the steps asked', () => {
		const m = chainsModel(response(), [A, B], names, 2);
		expect(m.blocks.map((b) => b.steps)).toEqual([2]);
	});
	it('puts each tussenbron once, in the row of the first chain that reaches it', () => {
		const m = chainsModel(response(), [A, B], names);
		expect([...m.between.keys()].sort()).toEqual([C, D]);
		expect(m.between.get(C)).toMatchObject({ block: 0, row: 0, at: 1 });
		expect(m.between.get(D)).toMatchObject({ block: 0, row: 1, at: 1 });
	});
	it('names a step by its line, or by what both share', () => {
		const m = chainsModel(response(), [A, B], names);
		const [via, direct] = m.blocks[0].rows;
		expect(via.steps[0].via?.name).toBe('35133, nr. 3');
		expect(via.steps[0].text).toBe('noemt beide');
		expect(via.steps[0].pair).toBe('Waterschapswet en Woningwet');
		expect(direct.steps[0].via).toBeNull();
		expect(direct.steps[0].text).toBe('noemt');
	});
	it('words a step for the phone and gives its lines their arrows', () => {
		const [via, direct] = chainsModel(response(), [A, B], names).blocks[0].rows;
		// The Kamerstuk names both laws: one line to each, the arrow at the law it names.
		expect(via.steps[0].phone).toBe('beide genoemd in 35133, nr. 3');
		expect(via.steps[0].legs).toEqual([
			{ relation: 'REFERS_TO', from: 'documents', arrow: 'start' },
			{ relation: 'REFERS_TO', from: 'documents', arrow: 'end' }
		]);
		// An edge between the laws: one line, its arrow at its target.
		expect(direct.steps[0].legs).toEqual([
			{ relation: 'REFERS_TO', from: 'instruments', arrow: 'end' }
		]);
	});
	it('says none when no block has a chain, and incomplete when a block ran out', () => {
		const empty = response({
			blocks: [2, 3].map((steps) => ({ steps, total: 0, complete: true, chains: [] }))
		});
		expect(chainsModel(empty, [A, B], names)).toMatchObject({ none: true, incomplete: false });
		const part = chainsModel(response({ partial: true }), [A, B], names);
		expect(part.incomplete).toBe(true);
		expect(part.blocks.every((b) => !b.complete)).toBe(true);
	});
	it('names the drawing with the chains in words', () => {
		const label = chainsLabel(chainsModel(response(), [A, B], names));
		expect(label).toContain('Verbindingsketens tussen Waterschapswet en Burgerlijk Wetboek Boek 7');
		expect(label).toContain('twee stappen, Waterschapswet, Woningwet');
	});
});

describe('countOf', () => {
	it('is N of M for a cut list, and at least N for an incomplete one', () => {
		expect(countOf(12, 67, true)).toBe('12 van 67 ketens');
		expect(countOf(3, 3, true)).toBeNull();
		expect(countOf(3, 3, false)).toBe('ten minste 3 ketens');
		expect(countOf(12, 40, false)).toBe('12 van ten minste 40 ketens');
		expect(countOf(0, 0, false)).toBeNull();
	});
});

describe('getChains', () => {
	it('asks /api/chains on the slow client, which waits 30 s, not the 10 s of api', async () => {
		const fake = fakeApi({ '/api/chains': response() as never });
		await getChains({ ids: `${A},${B}`, max_steps: 3 });
		expect(fake.requests[0]).toMatchObject({ client: 'slowApi', path: '/api/chains' });
	});
	it('passes a time-out on as one', async () => {
		fakeApi({ '/api/chains': slow() });
		await expect(getChains({ ids: `${A},${B}`, max_steps: 2 })).rejects.toSatisfy(isTimeout);
	});
});
