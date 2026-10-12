// Guard: "onderdeel van" (PART_OF) a container is its hull, never a line, whichever loader
// puts the edge on the canvas (Thijs, 12 Oct: a Kamerstuk on a line to its dossier 36764).
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { Schema } from '$lib/api/types';
import { getContainerGroup, isContainment } from './container-membership';
import { createGraphStore } from './graph-store';
import { createGraphContext } from './store/context';

const dossier = {
	id: 'dossiers/36764',
	key: '36764',
	collection: 'dossiers',
	type: 'dossier',
	display_name: 'Cyberbeveiligingswet',
	labels: [],
	props: { label: '36764', title: 'Cyberbeveiligingswet' }
};

const stuk = (key: string) => ({
	id: `documents/${key}`,
	key,
	collection: 'documents',
	type: 'document',
	display_name: `Kamerstuk 36764, nr. ${key}`,
	labels: [],
	props: { document_type: 'Memorie van toelichting' }
});

/** A stuk's node with its dossier as its one neighbour, by PART_OF. */
const response = (key: string) =>
	({
		node: stuk(key),
		neighbors: {
			total: 1,
			buckets: [
				{
					relation: 'PART_OF',
					collection: 'dossiers',
					direction: 'outbound',
					type: 'dossier',
					total: 1,
					items: [{ ...dossier, relation: 'PART_OF', direction: 'outbound' }]
				}
			]
		}
	}) as unknown as Schema<'NodeGraphResponse'>;

const linesToDossier = (store: ReturnType<typeof createGraphStore>) =>
	get(store.edges).filter((e) => e.source === dossier.id || e.target === dossier.id);

describe('isContainment', () => {
	it('is PART_OF into a wet, dossier or commissie, not a lid in a fractie', () => {
		expect(isContainment('dossier', 'PART_OF')).toBe(true);
		expect(isContainment('instrument', 'PART_OF')).toBe(true);
		expect(isContainment('instrument', 'REFERS_TO')).toBe(false);
		expect(isContainment('committee', 'MEMBER_OF')).toBe(false);
		expect(isContainment('faction', 'PART_OF')).toBe(false);
	});
});

describe('a stuk onderdeel van a dossier', () => {
	it('stands in the hull when the dossier ties two chosen stukken, without a line', () => {
		const store = createGraphStore();
		store.compose({
			participants: [{ response: response('3') }, { response: response('4') }],
			withJoining: true,
			fresh: true
		});
		expect(linesToDossier(store)).toEqual([]);
		const group = getContainerGroup('dossiers/36764');
		expect([...(group?.parts ?? [])]).toEqual(
			expect.arrayContaining(['documents/3', 'documents/4'])
		);
	});

	it('stands in the hull when the stuk is the focus', () => {
		const ctx = createGraphContext();
		ctx.mergeResponse(response('5'));
		expect([...ctx.edges.values()].filter((e) => e.target === dossier.id)).toEqual([]);
		expect(getContainerGroup('dossiers/36764')?.parts.has('documents/5')).toBe(true);
	});

	it('stands in the hull when its dossier is put on the canvas as a row', () => {
		const store = createGraphStore();
		store.compose({ participants: [{ response: response('6') }], withJoining: false, fresh: true });
		store.showRows('documents/6', [
			{
				ref: { collection: 'dossiers', key: '36764' },
				title: '36764',
				relation: 'PART_OF',
				direction: 'outbound'
			}
		]);
		expect(linesToDossier(store)).toEqual([]);
		expect(getContainerGroup('dossiers/36764')?.parts.has('documents/6')).toBe(true);
	});

	it('stands in the hull on a path through the dossier', async () => {
		const store = createGraphStore();
		const node = (n: { collection: string; key: string }) => ({ ...n, labels: [], props: {} });
		await store.mergePaths({
			ids: ['documents/7', 'documents/8'],
			paths: [
				{
					source: 'documents/7',
					target: 'documents/8',
					node_ids: ['documents/7', dossier.id, 'documents/8'],
					edge_ids: ['e1', 'e2']
				}
			],
			nodes: [node(stuk('7')), node(dossier), node(stuk('8'))],
			edges: [
				{ id: 'e1', source: 'documents/7', target: dossier.id, relation: 'PART_OF' },
				{ id: 'e2', source: 'documents/8', target: dossier.id, relation: 'PART_OF' }
			]
		} as unknown as Schema<'PathsResponse'>);
		expect(linesToDossier(store)).toEqual([]);
		const group = getContainerGroup('dossiers/36764');
		expect([...(group?.parts ?? [])]).toEqual(
			expect.arrayContaining(['documents/7', 'documents/8'])
		);
	});
});
