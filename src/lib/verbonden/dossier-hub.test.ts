import { describe, expect, it } from 'vitest';
import { type Schema } from '$lib/api/types';
import { buildDossierHub } from './dossier-hub';
import { type Neighbor } from '$lib/api/nodes';
import node35869 from '$lib/fixtures/node-dossier-35869.json';
import node36327 from '$lib/fixtures/node-dossier-36327.json';
import documents36327 from '$lib/fixtures/documents-36327.json';
import committees from '$lib/fixtures/committees.json';

const neighbors = (fixture: { neighbors: { all: unknown[] } }) =>
	fixture.neighbors.all as Neighbor[];
const documents = documents36327 as unknown as Schema<'DossierDocumentsResponse'>;

describe('buildDossierHub', () => {
	it('finds the law of a dossier through LEGISLATED_IN', () => {
		const hub = buildDossierHub(neighbors(node35869), null, null, []);
		expect(hub.laws.map((l) => l.ref.key)).toEqual(['bwbr0046999']);
		expect(hub.laws[0].proposed).toBeFalsy();
	});

	it('names the committee of the activities of dossier 36327', () => {
		const hub = buildDossierHub(
			neighbors(node36327),
			null,
			null,
			committees as Schema<'CommitteeDTO'>[]
		);
		expect(hub.committees.map((c) => c.title)).toEqual([
			'Vaste commissie voor Justitie en Veiligheid'
		]);
	});

	it('splits the documents by chamber, the memorie van toelichting first', () => {
		const hub = buildDossierHub([], documents, null, []);
		expect(hub.tweedeKamer[0].title).toMatch(/^Memorie van toelichting/);
		expect(hub.eersteKamer.length).toBeGreaterThan(0);
		expect(hub.eersteKamer.every((r) => r.ref.key.startsWith('ek_'))).toBe(true);
		expect(hub.tweedeKamer.some((r) => r.ref.key.startsWith('ek_'))).toBe(false);
	});

	it('marks a law that is only changed by a proposal', () => {
		const mutations = {
			number: '1',
			nodes: [{ id: 'articles/bwbr0001854_287', key: 'bwbr0001854_287', collection: 'articles' }],
			edges: [{ to_id: 'articles/bwbr0001854_287', relation: 'AMENDS', status: 'voorgesteld' }]
		} as unknown as Schema<'DossierMutationsResponse'>;
		const [law] = buildDossierHub([], null, mutations, [], () => 'Wetboek van Strafrecht').laws;
		expect(law).toMatchObject({ title: 'Wetboek van Strafrecht', proposed: true });
		expect(law.ref).toEqual({ collection: 'instruments', key: 'bwbr0001854' });
	});
});

describe('buildDossierHub with laws_named', () => {
	it('adds a law the title names: a link when loaded, grey when not', () => {
		const hub = buildDossierHub([], null, null, [], () => null, {
			instruments: [
				{
					id: 'instruments/bwbr0001854',
					key: 'bwbr0001854',
					bwb_id: 'BWBR0001854',
					display_name: 'Wetboek van Strafrecht',
					relation: 'amends',
					status: 'canoniek',
					links: []
				}
			],
			laws_named: [
				{ name: 'Wetboek van Strafrecht', loaded: true, key: 'bwbr0001854', bwb_id: 'BWBR0001854' },
				{
					name: 'Wetboek van Strafvordering',
					loaded: true,
					key: 'bwbr0001903',
					bwb_id: 'BWBR0001903'
				},
				{ name: 'Vreemdelingenwet 2000', loaded: false, key: null, bwb_id: null }
			]
		} as never);
		expect(hub.laws.map((r) => [r.title, !!r.missing])).toEqual([
			['Wetboek van Strafrecht', false],
			['Wetboek van Strafvordering', false],
			['Vreemdelingenwet 2000', true]
		]);
	});
});

describe('buildDossierHub: the wet from the dossier', () => {
	it('says its kind from the props on hand, its BWB id only without one', () => {
		const cbw = {
			id: 'instruments/bwbr0052872',
			key: 'bwbr0052872',
			bwb_id: 'BWBR0052872',
			display_name: 'Cyberbeveiligingswet',
			relation: 'legislated_in',
			status: 'canoniek',
			links: []
		};
		const node = { collection: 'instruments', key: 'bwbr0052872', props: { kind: 'wet' } };
		const met = buildDossierHub([], null, null, [], () => null, { instruments: [cbw] } as never, [
			node as never
		]);
		expect([met.laws[0].context, met.laws[0].identifier]).toEqual(['Wet', null]);
		const zonder = buildDossierHub([], null, null, [], () => null, { instruments: [cbw] } as never);
		expect(zonder.laws[0].identifier).toBe('BWBR0052872');
	});
});
