import { describe, expect, it } from 'vitest';
import { surroundingRows } from './surroundings';

const node = (id: string, props: Record<string, unknown> = {}) => ({
	id,
	key: id.split('/')[1],
	collection: id.split('/')[0],
	type: id.split('/')[0],
	display_name: id,
	labels: [],
	props
});
const empty = { total: 0, kinds: [], items: [] };

describe('the surroundings of a stuk on the canvas', () => {
	it('draws its indiener, its dossier as one bron and its own vote, not the zaak’s others', () => {
		const rows = surroundingRows({
			focal: node('documents/motie', { decision: 'eigen' }),
			submitters: [
				{
					node: node('members/piri'),
					edge_id: 'e',
					role: null,
					function: null,
					capacity: null,
					faction: null
				}
			],
			submitters_total: 1,
			dossiers: [{ node: node('dossiers/19637'), via: 'document', held: {} }],
			dossiers_total: 1,
			laws: empty,
			votes: [
				{ node: node('decisions/eigen'), about: null, factions: [] },
				{ node: node('decisions/andere'), about: null, factions: [] }
			],
			votes_total: 2,
			follows: empty,
			context: empty,
			gaps: []
		} as never);
		expect(rows.map((r) => [`${r.ref.collection}/${r.ref.key}`, r.relation, r.direction])).toEqual([
			['members/piri', 'AUTHORED', 'inbound'],
			['dossiers/19637', 'PART_OF', 'outbound'],
			['decisions/eigen', 'ABOUT', 'inbound']
		]);
	});
});
