import { describe, expect, it } from 'vitest';
import { type Schema } from '$lib/api/types';
import { buildDossierHub } from './dossier-hub';
import documents36327 from '$lib/fixtures/documents-36327.json';

const documents = documents36327 as unknown as Schema<'DossierDocumentsResponse'>;

const instrument = (key: string, relation: string, status = 'canoniek') => ({
	id: `instruments/${key}`,
	key,
	bwb_id: key.toUpperCase(),
	display_name: key,
	relation,
	status,
	links: []
});

describe('buildDossierHub', () => {
	it('has the law of a dossier from its detail: the wet it made, and one it changes', () => {
		const hub = buildDossierHub(
			{
				instruments: [
					instrument('bwbr0046999', 'legislated_in'),
					instrument('bwbr0001854', 'amends', 'voorgesteld')
				]
			} as never,
			null
		);
		expect(hub.laws.map((l) => [l.ref.key, l.relation, l.direction, !!l.proposed])).toEqual([
			['bwbr0046999', 'LEGISLATED_IN', 'inbound', false],
			['bwbr0001854', 'AMENDS', 'outbound', true]
		]);
	});

	it('names the committees of its detail by name, in order', () => {
		const hub = buildDossierHub(
			{
				committees: [
					{ key: 'c2', name: 'Vaste commissie voor Justitie en Veiligheid', abbreviation: 'J&V' },
					{ key: 'c1', name: 'Vaste commissie voor Digitale Zaken', abbreviation: 'DiZa' }
				]
			} as never,
			null
		);
		expect(hub.committees.map((c) => [c.title, c.context])).toEqual([
			['Vaste commissie voor Digitale Zaken', 'DiZa'],
			['Vaste commissie voor Justitie en Veiligheid', 'J&V']
		]);
	});

	it('splits the documents by chamber, the memorie van toelichting first', () => {
		const hub = buildDossierHub(null, documents);
		expect(hub.tweedeKamer[0].title).toMatch(/^Memorie van toelichting/);
		expect(hub.eersteKamer.length).toBeGreaterThan(0);
		expect(hub.eersteKamer.every((r) => r.ref.key.startsWith('ek_'))).toBe(true);
		expect(hub.tweedeKamer.some((r) => r.ref.key.startsWith('ek_'))).toBe(false);
	});
});

describe('buildDossierHub with laws_named', () => {
	it('adds a law the title names: a link when loaded, grey when not', () => {
		const hub = buildDossierHub(
			{
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
					{
						name: 'Wetboek van Strafrecht',
						loaded: true,
						key: 'bwbr0001854',
						bwb_id: 'BWBR0001854'
					},
					{
						name: 'Wetboek van Strafvordering',
						loaded: true,
						key: 'bwbr0001903',
						bwb_id: 'BWBR0001903'
					},
					{ name: 'Vreemdelingenwet 2000', loaded: false, key: null, bwb_id: null }
				]
			} as never,
			null
		);
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
		const met = buildDossierHub({ instruments: [cbw] } as never, null, [node as never]);
		expect([met.laws[0].context, met.laws[0].identifier]).toEqual(['Wet', null]);
		const zonder = buildDossierHub({ instruments: [cbw] } as never, null);
		expect(zonder.laws[0].identifier).toBe('BWBR0052872');
	});
});
