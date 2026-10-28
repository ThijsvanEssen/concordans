// Guard: "onderdeel van" (PART_OF) a container is its hull, never a line, whichever loader
// puts the edge on the canvas (Thijs, 12 Oct: a Kamerstuk on a line to its dossier 36764).
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { Schema } from '$lib/api/types';
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

/** The dossier's hull as the canvas gets it: after the microtask the store batches in. */
const hull = async (store: ReturnType<typeof createGraphStore>) => {
	await Promise.resolve();
	return get(store.containers).get(dossier.id);
};

const linesToDossier = (store: ReturnType<typeof createGraphStore>) =>
	get(store.edges).filter((e) => e.source === dossier.id || e.target === dossier.id);

describe('a stuk onderdeel van a dossier', () => {
	it('stands in the hull when the stuk is the focus', () => {
		const ctx = createGraphContext();
		ctx.mergeResponse(response('5'));
		expect([...ctx.edges.values()].filter((e) => e.target === dossier.id)).toEqual([]);
		expect([...(ctx.containers.get(dossier.id)?.parts ?? [])]).toEqual(['documents/5']);
	});

	it('stands in the hull when its dossier is put on the canvas as a row', async () => {
		const store = createGraphStore();
		store.compose({ participants: [{ response: response('6') }], fresh: true });
		store.showRows('documents/6', [
			{
				ref: { collection: 'dossiers', key: '36764' },
				title: '36764',
				relation: 'PART_OF',
				direction: 'outbound'
			}
		]);
		expect(linesToDossier(store)).toEqual([]);
		// The dossier the row names is its anchor, as when it ties two chosen stukken.
		expect([...((await hull(store))?.parts ?? [])]).toEqual([dossier.id, 'documents/6']);
	});
});
