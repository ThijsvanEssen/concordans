import { describe, expect, it } from 'vitest';
import node35869 from '$lib/fixtures/node-dossier-35869.json';
import node36327 from '$lib/fixtures/node-dossier-36327.json';
import documents36327 from '$lib/fixtures/documents-36327.json';
import committees from '$lib/fixtures/committees.json';
import type { Schema } from '$lib/api/types';
import { chamberOf, isExplanatory } from './chamber';
import { buildDossierHub } from './dossier-hub';
import { mergeExplanatory } from './explanatory-documents';
import { buildGroups, countLabel, GROUPS, isInternational } from './groups';
import type { Neighbor } from './rows';

const neighbors = (fixture: { neighbors: { all: unknown[] } }) =>
	fixture.neighbors.all as Neighbor[];
const documents = documents36327 as Schema<'DossierDocumentsResponse'>;

describe('chamberOf', () => {
	it('reads the chamber from the key', () => {
		expect(chamberOf({ key: 'ek_kst_36327_o' })).toBe('EK');
		expect(chamberOf({ key: 'a572870e_709d_484c_872d_5d84d0829030' })).toBe('TK');
	});

	it('knows the explanatory kinds as the source writes them', () => {
		expect(isExplanatory('Memorie van toelichting')).toBe(true);
		expect(isExplanatory('Memorie van toelichting (initiatiefvoorstel)')).toBe(true);
		expect(isExplanatory('Nota van toelichting')).toBe(true);
		expect(isExplanatory('Nota naar aanleiding van het verslag')).toBe(false);
		expect(isExplanatory(null)).toBe(false);
	});
});

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
		expect(hub.tweedeKamer[0].context).toMatch(/^Memorie van toelichting/);
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

describe('mergeExplanatory', () => {
	const doc = (key: string, relation: string, date: string, kind = 'Memorie van toelichting') =>
		({
			id: `documents/${key}`,
			key,
			collection: 'documents',
			relation,
			direction: 'inbound',
			display_name: key,
			props: { kind, date }
		}) as unknown as Neighbor;

	it('puts a document bound to the article before one that only names it, then the newest', () => {
		const rows = mergeExplanatory(
			[
				doc('names-2025', 'REFERS_TO', '2025-03-07'),
				doc('amends-2019', 'AMENDS', '2019-01-01'),
				doc('brief', 'REFERS_TO', '2026-01-01', 'Brief regering')
			],
			{ items: { '36327': documents.items } } as Schema<'DossierDocumentsBulkResponse'>
		);
		expect(rows.map((r) => r.ref.key)).toEqual([
			'amends-2019',
			'names-2025',
			'a572870e_709d_484c_872d_5d84d0829030'
		]);
		expect(rows.map((r) => r.derived)).toEqual([false, true, true]);
	});
});

describe('buildGroups', () => {
	it('fills the groups of a dossier that the node response knows', () => {
		const groups = buildGroups('dossiers', neighbors(node36327));
		const decisions = groups.find((g) => g.id === 'decisions')!;
		expect(decisions.rows.length).toBeGreaterThan(0);
		expect(groups.find((g) => g.id === 'laws')!.rows).toEqual([]);
	});

	it('marks a bucket at the cap of the API', () => {
		const many = Array.from({ length: 30 }, (_, i) => ({
			id: `judgments/j${i}`,
			key: `j${i}`,
			collection: 'judgments',
			relation: 'REFERS_TO',
			direction: 'inbound',
			props: {}
		})) as unknown as Neighbor[];
		const group = buildGroups('articles', many).find((g) => g.id === 'judgments')!;
		expect(countLabel(group)).toBe('30+');
		expect(countLabel({ rows: group.rows.slice(0, 4), capped: false })).toBe('4');
	});

	it('sends a treaty article to Europees en internationaal, not to Verwijst naar', () => {
		const evrm = {
			id: 'articles/bwbv0001000_6',
			key: 'bwbv0001000_6',
			collection: 'articles',
			relation: 'REFERS_TO',
			direction: 'outbound',
			props: {}
		} as unknown as Neighbor;
		expect(isInternational(evrm)).toBe(true);
		const groups = buildGroups('articles', [evrm]);
		expect(groups.find((g) => g.id === 'international')!.rows).toHaveLength(1);
		expect(groups.find((g) => g.id === 'refers-to')!.rows).toHaveLength(0);
	});

	it('gives every group a source and a unique id per kind', () => {
		for (const defs of Object.values(GROUPS)) {
			expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
			for (const d of defs) expect(Boolean(d.match) !== Boolean(d.load)).toBe(true);
		}
	});
});
