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
