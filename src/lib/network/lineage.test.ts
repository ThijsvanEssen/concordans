import { describe, expect, it } from 'vitest';
import { lineage } from './lineage';

const node = (id: string, props: Record<string, unknown>) => ({
	id,
	key: id.split('/')[1],
	collection: id.split('/')[0],
	type: 'judgment',
	display_name: id,
	labels: [],
	props
});
/** A node with its APPEAL_OF and ADVISES_ON buckets. */
const response = (
	id: string,
	tier: string,
	buckets: { relation: string; direction: string; items: [string, string][] }[]
) =>
	({
		node: node(id, { tier }),
		neighbors: {
			total: 0,
			buckets: buckets.map((b) => ({
				...b,
				collection: 'judgments',
				type: 'judgment',
				total: b.items.length,
				next_offset: null,
				items: b.items.map(([i, t]) => node(i, { tier: t }))
			}))
		}
	}) as never;

const HR = response('judgments/hr', 'hoge_raad', [
	{ relation: 'APPEAL_OF', direction: 'outbound', items: [['judgments/hof', 'gerechtshof']] },
	{ relation: 'ADVISES_ON', direction: 'inbound', items: [['judgments/phr', 'parket']] }
]);
const HOF = response('judgments/hof', 'gerechtshof', [
	{ relation: 'APPEAL_OF', direction: 'outbound', items: [['judgments/rb', 'rechtbank']] },
	{ relation: 'APPEAL_OF', direction: 'inbound', items: [['judgments/hr', 'hoge_raad']] }
]);
const RB = response('judgments/rb', 'rechtbank', [
	{ relation: 'APPEAL_OF', direction: 'inbound', items: [['judgments/hof', 'gerechtshof']] }
]);
const ask = async (id: string) => ({ 'judgments/hof': HOF, 'judgments/rb': RB })[id] ?? null;

describe('the keten of a judgment', () => {
	it('stands in its instances, the earliest on top, the conclusie before the arrest', async () => {
		const layers = await lineage(HR, ['APPEAL_OF', 'ADVISES_ON'], ask);
		expect(layers.map((l) => l.label)).toEqual([
			'Rechtbank',
			'Gerechtshof',
			'Conclusie P-G',
			'Hoge Raad'
		]);
		const hr = layers.at(-1)!.nodes[0];
		expect(hr.parents.map((p) => p.id).sort()).toEqual(['judgments/hof', 'judgments/phr']);
	});
});

describe('the keten of a person', () => {
	const seat = (relation: string, items: [string, string][]) => ({
		relation,
		direction: 'outbound',
		collection: 'x',
		type: 'x',
		total: items.length,
		next_offset: null,
		items: items.map(([id, collection]) => ({ ...node(id, {}), collection, key: id.split('/')[1] }))
	});
	const person = {
		node: { ...node('members/jetten', {}), collection: 'members' },
		neighbors: {
			total: 0,
			// Given in the wrong order on purpose: the layers keep the order of their rubriek.
			buckets: [
				seat('SERVED_IN', [
					['ministries/azw', 'ministries'],
					['cabinets/jetten', 'cabinets']
				]),
				seat('MEMBER_OF', [
					['committees/pres', 'committees'],
					['factions/d66', 'factions']
				])
			]
		}
	} as never;

	it('stands in Parlement first (Fractie, Commissie), then Regering (Kabinet, Ministerie)', async () => {
		const layers = await lineage(person, ['MEMBER_OF', 'SERVED_IN'], async () => null);
		expect(layers.map((l) => l.label)).toEqual([
			'Kamerlid',
			'Fractie',
			'Commissie',
			'Kabinet',
			'Ministerie'
		]);
	});
	it('leaves out a layer that is empty', async () => {
		const only = {
			...(person as object),
			neighbors: { total: 0, buckets: [seat('MEMBER_OF', [['factions/d66', 'factions']])] }
		} as never;
		const layers = await lineage(only, ['MEMBER_OF', 'SERVED_IN'], async () => null);
		expect(layers.map((l) => l.label)).toEqual(['Kamerlid', 'Fractie']);
	});
});
