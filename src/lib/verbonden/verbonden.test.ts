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
import {
	bundleMentions,
	mentionRows,
	metaParts,
	positionsLabel,
	type Neighbor,
	type Row,
	describe as describeBron,
	UNNAMED
} from './rows';

const neighbors = (fixture: { neighbors: { all: unknown[] } }) =>
	fixture.neighbors.all as Neighbor[];
const documents = documents36327 as unknown as Schema<'DossierDocumentsResponse'>;

describe('chamberOf', () => {
	it('reads the chamber from the key', () => {
		expect(chamberOf({ key: 'ek_kst_36327_o' })).toBe('EK');
		expect(chamberOf({ key: 'a572870e_709d_484c_872d_5d84d0829030' })).toBe('TK');
	});

	it('knows the explanatory kinds as the source writes them', () => {
		expect(isExplanatory({ kind: 'Memorie van toelichting' })).toBe(true);
		expect(isExplanatory({ kind: 'Memorie van toelichting (initiatiefvoorstel)' })).toBe(true);
		expect(isExplanatory({ kind: 'Nota van toelichting' })).toBe(true);
		expect(isExplanatory({ kind: 'Nota naar aanleiding van het verslag' })).toBe(false);
		expect(isExplanatory({ kind: null })).toBe(false);
		expect(isExplanatory({ kind: 'Brief', is_explanatory: true })).toBe(true);
		expect(chamberOf({ key: 'x', chamber: 'EK' })).toBe('EK');
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

	it('lists only the documents bound to the article; one that merely names it, or names its dossier without an edge to it, is left out', () => {
		const rows = mergeExplanatory([
			doc('names-2025', 'REFERS_TO', '2025-03-07'),
			doc('amends-2019', 'AMENDS', '2019-01-01'),
			doc('brief', 'REFERS_TO', '2026-01-01', 'Brief regering')
		]);
		expect(rows.map((r) => r.ref.key)).toEqual(['amends-2019']);
		expect(rows.map((r) => r.derived)).toEqual([false]);
	});
});

describe('buildGroups', () => {
	it('fills the groups of a dossier that the node response knows', () => {
		const groups = buildGroups('dossiers', neighbors(node36327));
		const decisions = groups.find((g) => g.id === 'decisions')!;
		expect(decisions.rows.length).toBeGreaterThan(0);
		expect(groups.find((g) => g.id === 'laws')!.rows).toEqual([]);
	});

	it('marks a bucket at the cap of an API without totals, and prints the total of one with', () => {
		const many = Array.from({ length: 30 }, (_, i) => ({
			id: `articles/a${i}`,
			key: `a${i}`,
			collection: 'articles',
			relation: 'REFERS_TO',
			direction: 'outbound',
			props: {}
		})) as unknown as Neighbor[];
		const group = buildGroups('articles', many).find((g) => g.id === 'refers-to')!;
		expect(countLabel(group)).toBe('30+');
		expect(countLabel({ rows: group.rows.slice(0, 4), capped: false })).toBe('4');
		const totals = new Map([['REFERS_TO/articles/outbound', 1412]]);
		const counted = buildGroups('articles', many, totals).find((g) => g.id === 'refers-to')!;
		expect(counted.capped).toBe(false);
		expect(countLabel(counted)).toBe('1.412');
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
		expect(groups.find((g) => g.id === 'international')!.rows[0].kind).toBe('internationaal');
		expect(groups.find((g) => g.id === 'refers-to')!.rows).toHaveLength(0);
	});

	it('reads the lid a citing Kamerstuk names from the phrase of the edge', () => {
		const mvt = {
			id: 'documents/d1',
			key: 'd1',
			collection: 'documents',
			relation: 'REFERS_TO',
			direction: 'inbound',
			display_name: 'Kamerstuk 36693, nr. 3',
			props: { kind: 'Memorie van toelichting', sequence: '3', dossier_numbers: ['36693'] },
			edge_id: 'e1',
			confidence: 0.95,
			status: 'canoniek',
			meta: {
				raw_match: 'artikel 300, tweede lid, Sr',
				snippet: 'zoals artikel 300, tweede lid, Sr bepaalt'
			}
		} as unknown as Neighbor;
		const groups = buildGroups('articles', [mvt]);
		const row = groups.find((g) => g.id === 'documents')!.rows[0];
		expect(row.kind).toBe('toelichtingen');
		expect(row.lid).toBe('2');
		expect(row.title).toBe('Memorie van toelichting, Kamerstuk 36693, nr. 3');
		expect(row.match).toBe('artikel 300, tweede lid, Sr');
		expect(row.derived).toBe(true);
		expect(row.proposed).toBeUndefined();
	});

	it('gives every group a source and a unique id per kind', () => {
		for (const defs of Object.values(GROUPS)) {
			expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
			for (const d of defs) expect(Boolean(d.match) !== Boolean(d.load)).toBe(true);
		}
	});
});

describe('bundleMentions', () => {
	const mention = (position: string, confidence: number, lid: string | null = null): Row => ({
		ref: { collection: 'judgments', key: 'ecli_nl_hr_2019_1278' },
		title: 'Hoge Raad, 19 juli 2019',
		context: null,
		kind: 'uitspraken',
		position,
		confidence,
		lid,
		derived: confidence < 1
	});

	it('makes one row of the mentions of one bron, keeping each mention', () => {
		const row = bundleMentions([
			mention('r.o. 2.2.2', 0.8),
			mention('r.o. 2.4.1', 0.95, '1'),
			mention('r.o. 2.7.3', 0.9)
		]);
		expect(row.position).toBe('r.o. 2.2.2, 2.4.1 en 1 meer');
		expect(row.confidence).toBe(0.95);
		expect(row.lid).toBe('1');
		expect(row.mentions).toHaveLength(3);
		expect(mentionRows([row])).toHaveLength(3);
	});

	it('leaves a single mention as it is', () => {
		const one = mention('r.o. 3.1', 1);
		expect(bundleMentions([one])).toBe(one);
		expect(positionsLabel(['r.o. 3.1', 'r.o. 3.2'])).toBe('r.o. 3.1 en 3.2');
	});
});

describe('metaParts', () => {
	it('names the betrouwbaarheid only when it is not hoog', () => {
		const base: Row = {
			ref: { collection: 'judgments', key: 'j' },
			title: 't',
			context: null,
			kind: 'uitspraken'
		};
		expect(metaParts({ ...base, confidence: 0.95, derived: true }).map((p) => p.text)).toEqual([]);
		expect(metaParts({ ...base, confidence: 0.7 }).map((p) => p.text)).toEqual([
			'betrouwbaarheid matig'
		]);
	});
});

describe('conclusion in the same case', () => {
	const judgment = (ecli: string, relation = 'REFERS_TO', direction = 'inbound') =>
		({
			id: `judgments/${ecli.toLowerCase().replaceAll(':', '_')}`,
			key: ecli.toLowerCase().replaceAll(':', '_'),
			collection: 'judgments',
			relation,
			direction,
			props: { ecli }
		}) as unknown as Neighbor;

	it('puts the conclusion that advises on the judgment in a group of its own', () => {
		const groups = buildGroups('judgments', [
			judgment('ECLI:NL:PHR:2019:496'),
			judgment('ECLI:NL:PHR:2020:10'),
			judgment('ECLI:NL:RBNNE:2024:1'),
			judgment('ECLI:NL:PHR:2019:496', 'ADVISES_ON')
		]);
		expect(groups.find((g) => g.id === 'conclusion')!.rows.map((r) => r.identifier)).toEqual([
			'ECLI:NL:PHR:2019:496'
		]);
		expect(groups.find((g) => g.id === 'cited-by')!.rows).toHaveLength(2);
	});

	it('leaves the conclusion out of the totals of the citing and cited judgments', () => {
		const groups = buildGroups(
			'judgments',
			[
				judgment('ECLI:NL:PHR:2019:496'),
				judgment('ECLI:NL:PHR:2019:496', 'REFERS_TO', 'outbound'),
				judgment('ECLI:NL:RBNNE:2024:1'),
				judgment('ECLI:NL:HR:2018:1', 'REFERS_TO', 'outbound'),
				judgment('ECLI:NL:PHR:2019:496', 'ADVISES_ON')
			],
			new Map([
				['REFERS_TO/judgments/inbound', 28],
				['REFERS_TO/judgments/outbound', 5],
				['ADVISES_ON/judgments/inbound', 1]
			])
		);
		expect(groups.find((g) => g.id === 'conclusion')!.total).toBe(1);
		expect(groups.find((g) => g.id === 'cited-by')!.total).toBe(27);
		expect(groups.find((g) => g.id === 'judgments')!.total).toBe(4);
	});

	it('names the judgment a conclusion advises on', () => {
		const groups = buildGroups('judgments', [
			judgment('ECLI:NL:HR:2019:1278', 'ADVISES_ON', 'outbound'),
			judgment('ECLI:NL:HR:2019:1278', 'REFERS_TO', 'inbound')
		]);
		expect(groups.find((g) => g.id === 'advised')!.rows).toHaveLength(1);
		expect(groups.find((g) => g.id === 'cited-by')!.rows).toHaveLength(0);
	});
});

describe('describe, a bron without a name', () => {
	it('says the name is unknown instead of showing the database key', () => {
		expect(
			describeBron('members', '71868ebc_5700_4a64_9d6e_0110f2148b38', '', { name: '' }).title
		).toBe(UNNAMED);
		expect(describeBron('members', 'k', null, { name: 'Claudia van Bruggen' }).title).toBe(
			'Claudia van Bruggen'
		);
	});
});
