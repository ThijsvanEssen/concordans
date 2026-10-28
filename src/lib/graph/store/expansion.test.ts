import { describe, expect, it } from 'vitest';
import { fakeApi } from '$lib/test/fakeApi';
import { createGraphContext } from './context';
import { createExpansion } from './expansion';

const PATH = '/api/nodes/{collection}/{key}/neighborhood';
const EMPTY = { focal_id: 'documents/motie', nodes: [], edges: [], buckets: [] };

describe('the neighbourhood of a bron (#871)', () => {
	it('stops at a lid, fractie, commissie, kabinet or ministerie', async () => {
		const fake = fakeApi({ [PATH]: EMPTY });
		await createExpansion(createGraphContext()).expandNeighborhood('documents', 'motie');
		expect(fake.asked(PATH)[0].query).toMatchObject({
			stop_at: 'members,factions,committees,cabinets,ministries'
		});
	});

	it('walks as asked where it is narrowed to some relations', async () => {
		const fake = fakeApi({ [PATH]: EMPTY });
		await createExpansion(createGraphContext()).expandNeighborhood('documents', 'motie', {
			relations: ['AUTHORED']
		});
		expect(fake.asked(PATH)[0].query?.stop_at).toBeUndefined();
	});
});

describe('the neighbourhood of a ministerie (UX review N5)', () => {
	const bzk = { id: 'ministries/bzk', key: 'bzk', collection: 'ministries', type: 'ministry' };
	const node = (collection: string, key: string, props: Record<string, unknown> = {}) => ({
		id: `${collection}/${key}`,
		key,
		collection,
		type: collection.slice(0, -1),
		display_name: key,
		labels: [],
		props
	});
	const edge = (source: string, target: string, relation: string) => ({
		id: `${source}-${target}`,
		source,
		target,
		relation,
		confidence: null,
		status: 'canoniek',
		meta: null
	});

	it('draws it as its hull, with its bewindspersonen and toezeggingen in it', async () => {
		const response = {
			focal_id: bzk.id,
			nodes: [
				{ ...bzk, display_name: 'Binnenlandse Zaken', labels: [], props: { abbreviation: 'BZK' } },
				node('members', 'remkes'),
				node('commitments', 'tz1', { number: 'TZ202306-087' }),
				node('instruments', 'bwbr0005416', { bwb_id: 'BWBR0005416' })
			],
			edges: [
				edge('members/remkes', bzk.id, 'SERVED_IN'),
				edge('commitments/tz1', bzk.id, 'LED_BY'),
				edge('instruments/bwbr0005416', bzk.id, 'LED_BY')
			],
			buckets: []
		};
		fakeApi({ [PATH]: response });
		const ctx = createGraphContext();
		await createExpansion(ctx).expandNeighborhood('ministries', 'bzk');
		const group = ctx.containers.get(bzk.id);
		expect(group?.kind).toBe('cabinet');
		expect(group?.label).toBe('BZK');
		expect([...(group?.members ?? [])].sort()).toEqual([
			'commitments/tz1',
			'members/remkes',
			'ministries/bzk'
		]);
		// Its anchor is on the canvas, the bron the canvas is about.
		expect(ctx.nodes.get(bzk.id)?.anchor).toBe(true);
	});
});
