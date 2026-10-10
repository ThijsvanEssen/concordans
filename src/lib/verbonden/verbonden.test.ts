import { zaakRang } from '$lib/bron/zaak';
import { describe, expect, it } from 'vitest';
import node35869 from '$lib/fixtures/node-dossier-35869.json';
import node36327 from '$lib/fixtures/node-dossier-36327.json';
import documents36327 from '$lib/fixtures/documents-36327.json';
import committees from '$lib/fixtures/committees.json';
import type { Schema } from '$lib/api/types';
import { chamberOf, isExplanatory } from './chamber';
import { buildDossierHub } from './dossier-hub';
import { mergeExplanatory } from './explanatory-documents';
import { buildGroups, countLabel, GROUPS, isInternational, withUnresolvedAppeals } from './groups';
import {
	aardOf,
	bundleMentions,
	unresolvedRows,
	mentionRows,
	metaParts,
	openLabelOf,
	passageOf,
	positionsLabel,
	type Neighbor,
	type Row,
	describe as describeBron,
	caseNumberOf,
	repeatedTitles,
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
		// The Tweede Kamer's votes come from their own loader, without the amendementen.
		const decisions = groups.find((g) => g.id === 'decisions')!;
		expect(decisions.rows).toEqual([]);
		expect(groups.find((g) => g.id === 'commitments')!.rows.length).toBeGreaterThan(0);
		expect(groups.find((g) => g.id === 'laws')!.rows).toEqual([]);
	});

	it('names a paper as the Kamerstuk of its own dossier', () => {
		const verslag = {
			id: 'documents/v1',
			key: 'v1',
			collection: 'documents',
			relation: 'REFERS_TO',
			direction: 'inbound',
			props: {
				kind: 'Verslag van een wetgevingsoverleg',
				sequence: '11',
				dossier_number: '31058',
				dossier_numbers: ['31746', '31058']
			}
		} as unknown as Neighbor;
		const row = buildGroups('articles', [verslag]).find((g) => g.id === 'documents')!.rows[0];
		expect(row.title).toBe('Verslag van een wetgevingsoverleg, Kamerstuk 31058, nr. 11');
	});

	it('puts the votes on a dossier under the Kamer that cast them', () => {
		const vote = (key: string, chamber?: string) =>
			({
				id: `decisions/${key}`,
				key,
				collection: 'decisions',
				relation: 'ABOUT',
				direction: 'inbound',
				props: chamber ? { chamber } : {}
			}) as unknown as Neighbor;
		const groups = buildGroups('dossiers', [
			vote('tk_1', 'TK'),
			vote('ek_2026_09_22_36901_1', 'EK'),
			vote('ek_2026_09_29_36791_1')
		]);
		// The Tweede Kamer's come from the decision browser (dossier-decisions-tk).
		expect(groups.find((g) => g.id === 'decisions')!.rows).toHaveLength(0);
		const ek = groups.find((g) => g.id === 'decisions-ek')!;
		expect(ek.section).toBe('Eerste Kamer');
		expect(ek.rows).toHaveLength(2);
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
		expect(positionsLabel(['onder 3.4', 'onder 4.1', 'onder 5'])).toBe('onder 3.4, 4.1 en 1 meer');
		expect(positionsLabel(['§ 9', '§ 12'])).toBe('§ 9 en 12');
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

	it('does not say the name again under it', () => {
		const fractie: Row = {
			ref: { collection: 'factions', key: 'd66' },
			title: 'D66-fractie',
			context: 'D66',
			kind: 'leden'
		};
		expect(metaParts(fractie).map((p) => p.text)).toEqual([]);
		expect(metaParts(fractie, true).map((p) => p.text)).toEqual([]);
		// Part of a word is no repeat: "D6" under "D66-fractie" stays.
		expect(metaParts({ ...fractie, context: 'D6' }).map((p) => p.text)).toEqual(['D6']);
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

	it('tells the earlier instance from the later one, and names the remedy', () => {
		const appeal = (ecli: string, direction: string, procedure: string) => ({
			...judgment(ecli, 'APPEAL_OF', direction),
			meta: { procedure_type: procedure }
		});
		const groups = buildGroups('judgments', [
			appeal('ECLI:NL:GHDHA:2025:861', 'outbound', 'Cassatie'),
			appeal('ECLI:NL:HR:2027:1', 'inbound', 'Cassatie')
		]);
		const earlier = groups.find((g) => g.id === 'earlier-instance')!.rows;
		expect(earlier.map((r) => r.identifier)).toEqual(['ECLI:NL:GHDHA:2025:861']);
		expect(metaParts(earlier[0]).map((p) => p.text)).toContain('cassatie');
		expect(groups.find((g) => g.id === 'later-instance')!.rows).toHaveLength(1);
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

describe('sister cases', () => {
	it('finds the titles rows share, and the case number that tells them apart', () => {
		const row = (ecli: string, display_name: string) =>
			({
				title: 'Gerechtshof Amsterdam, 22 september 2026',
				identifier: ecli,
				props: { display_name }
			}) as unknown as Row;
		const rows = [
			row('ECLI:NL:GHAMS:2026:2678', 'Gerechtshof Amsterdam 2026-09-22 / 200.343.062/01'),
			row('ECLI:NL:GHAMS:2026:2679', 'Gerechtshof Amsterdam 2026-09-22 / 200.343.064/01')
		];
		expect([...repeatedTitles(rows)]).toEqual(['Gerechtshof Amsterdam, 22 september 2026']);
		expect(rows.map(caseNumberOf)).toEqual(['200.343.062/01', '200.343.064/01']);
		expect(caseNumberOf({ ...rows[0], props: {} } as Row)).toBe('2678');
	});

	it('say of a judgment outside the dataset that it is, without a case number', () => {
		const props = { court_code: 'HR', ecli: 'ECLI:NL:HR:2017:305', stub: true };
		const bron = describeBron('judgments', 'ecli_nl_hr_2017_305', null, props);
		expect(bron.title).toBe('Hoge Raad');
		expect(bron.context).toBe('niet in de gegevens');
		const row: Row = {
			ref: { collection: 'judgments', key: 'k' },
			kind: 'uitspraken',
			...bron,
			props
		};
		expect(caseNumberOf(row)).toBeNull();
		expect(metaParts(row).map((p) => p.text)).toEqual([
			'niet in de gegevens',
			'ECLI:NL:HR:2017:305'
		]);
	});
});

describe('a relation the list does not know yet', () => {
	it('lands in Andere verbindingen instead of disappearing', () => {
		const groups = buildGroups('judgments', [
			{
				id: 'judgments/ecli_nl_gharl_2026_5455',
				key: 'ecli_nl_gharl_2026_5455',
				collection: 'judgments',
				relation: 'OVERRULES',
				direction: 'inbound',
				props: { ecli: 'ECLI:NL:GHARL:2026:5455' }
			} as unknown as Neighbor
		]);
		const other = groups.find((g) => g.id === 'other');
		expect(other?.label).toBe('Andere verbindingen');
		expect(other?.rows.map((r) => r.identifier)).toEqual(['ECLI:NL:GHARL:2026:5455']);
	});
});

describe('a row opened under itself', () => {
	it('marks the cited phrase in its passage', () => {
		expect(
			passageOf({ snippet: 'in strijd met art. 6:162 BW gehandeld', match: 'art. 6:162 BW' })
		).toEqual({
			before: 'in strijd met ',
			mark: 'art. 6:162 BW',
			after: ' gehandeld'
		});
		expect(passageOf({ snippet: null, match: null })).toBeNull();
	});

	it('says where opening it goes', () => {
		expect(openLabelOf({ position: 'r.o. 6.16', at: 'rov-6.16' })).toBe('Lees bij r.o. 6.16');
		expect(openLabelOf({ position: null, at: null })).toBe('Lees');
		expect(openLabelOf({ position: null, at: null }, true)).toBe('Lees naast het artikel');
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

describe('the groups of a judgment', () => {
	it('tell the judgments it cites from those that cite it by more than one letter', () => {
		const labels = Object.fromEntries((GROUPS.judgments ?? []).map((g) => [g.id, g.label]));
		expect(labels.judgments).toBe('Uitspraken die hier worden aangehaald');
		expect(labels['cited-by']).toBe('Uitspraken die deze uitspraak aanhalen');
		expect(labels.articles).toBe('Artikelen die hier worden aangehaald');
	});
});

describe('judgments of one case', () => {
	const neighbor = (key: string, relation: string, direction: 'inbound' | 'outbound') =>
		({
			id: `judgments/${key}`,
			key,
			collection: 'judgments',
			relation,
			direction,
			props: { ecli: key.toUpperCase().replaceAll('_', ':') }
		}) as unknown as Neighbor;
	it('have a group of their own for each way of CONTINUES and REFERRED_BY', () => {
		const groups = buildGroups('judgments', [
			neighbor('ecli_nl_ghdha_2026_2188', 'CONTINUES', 'outbound'),
			neighbor('ecli_nl_ghdha_2026_2900', 'CONTINUES', 'inbound'),
			neighbor('ecli_nl_hr_2025_1', 'REFERRED_BY', 'outbound'),
			neighbor('ecli_nl_gharl_2026_5455', 'REFERRED_BY', 'inbound')
		]);
		const label = (id: string) => groups.find((g) => g.id === id);
		expect(label('continues')?.label).toBe('Vervolg op');
		expect(label('continued')?.label).toBe('Voortgezet in');
		expect(label('referred-by')?.label).toBe('Verwezen door');
		expect(label('referred-to')?.label).toBe('Verwezen naar');
		expect(groups.find((g) => g.id === 'other')?.rows ?? []).toEqual([]);
	});

	it('show the other publications of the same decision first, in either direction of SAME_AS', () => {
		const replaced = buildGroups('judgments', [
			neighbor('ecli_nl_hr_2011_bn6324', 'SAME_AS', 'outbound'),
			neighbor('ecli_nl_hr_2016_252', 'REFERS_TO', 'outbound')
		]);
		expect(replaced[0].id).toBe('same-as');
		expect(replaced[0].label).toBe('Zelfde uitspraak, ook gepubliceerd als');
		expect(replaced[0].rows.map((r) => r.ref.key)).toEqual(['ecli_nl_hr_2011_bn6324']);
		const kept = buildGroups('judgments', [
			neighbor('ecli_nl_hr_2011_bw1231', 'SAME_AS', 'inbound')
		]);
		expect(kept.find((g) => g.id === 'same-as')?.rows).toHaveLength(1);
	});
});

describe('an appealed decision the dataset lacks', () => {
	it('stands under Uitspraak in eerdere aanleg, grey and without a link', () => {
		const groups = withUnresolvedAppeals(buildGroups('judgments', []), {
			unresolved_appeal_targets: [
				{ court: 'rechtbank Gelderland', date: '2025-07-09', case_number: '24/6811' }
			]
		});
		const rows = groups.find((g) => g.id === 'earlier-instance')?.rows ?? [];
		expect(rows.map((r) => [r.title, r.missing])).toEqual([
			['Rechtbank Gelderland, 9 juli 2025, 24/6811', true]
		]);
	});
	it('leaves the groups as they are without one', () => {
		const groups = buildGroups('judgments', []);
		expect(withUnresolvedAppeals(groups, {})).toBe(groups);
	});
});

describe('unresolvedRows', () => {
	it('lists an article of a law the dataset lacks, grey and without a link', () => {
		const [row] = unresolvedRows([
			{ law: 'Rv', article_number: '843a', leden: ['1'], paragraph_ids: ['rov-3.2'] }
		]);
		expect(row.title).toBe('Artikel 843a Rv');
		expect(row.missing).toBe(true);
		expect(metaParts(row).map((p) => p.text)).toEqual(['lid 1', 'niet in de gegevens']);
	});
});

describe('aardOf', () => {
	it('says an aard the hand check found often wrong is only possible', () => {
		expect(aardOf('conditional_requirement', 0.3)).toBe('mogelijk voorwaarde');
		expect(aardOf('conditional_requirement', 0.9)).toBe('voorwaarde');
		expect(aardOf('definition', null)).toBe('definitie');
		expect(aardOf(null, 0.3)).toBeNull();
	});
});

describe('the judgments of the EHRM that cite an article of the EVRM', () => {
	it('count as the rows they are, not as the bucket of every citing judgment', () => {
		const judgment = (key: string, source: string) =>
			({
				id: `judgments/${key}`,
				key,
				collection: 'judgments',
				relation: 'REFERS_TO',
				direction: 'inbound',
				props: { source }
			}) as unknown as Neighbor;
		const neighbors = [
			judgment('ecli_ce_echr_2024_1210jud000447021', 'echr'),
			judgment('ecli_ce_echr_2025_0401jud000279916', 'echr'),
			judgment('ecli_nl_rvs_2026_5542', 'rechtspraak')
		];
		const totals = new Map([['REFERS_TO/judgments/inbound', 435]]);
		const group = buildGroups('articles', neighbors, totals).find((g) => g.id === 'international')!;
		expect(group.rows).toHaveLength(2);
		expect(group.total).toBeUndefined();
		expect(group.capped).toBe(true);
	});
});

describe('a judgment of the EHRM', () => {
	it('is named by its court in Dutch, not by its code', () => {
		const bron = describeBron('judgments', 'k', null, {
			court_code: 'ECHR',
			date: '2024-12-10',
			ecli: 'ECLI:CE:ECHR:2024:1210JUD000447021'
		});
		expect(bron.title).toBe('Europees Hof voor de Rechten van de Mens, 10 december 2024');
	});
});

describe('zaakRang', () => {
	it('puts the substance first and the geleidende brief last, by the kind the source gives', () => {
		const rang = (kind: string) => zaakRang({ props: { kind } });
		expect(rang('Memorie van toelichting (initiatiefvoorstel)')).toBe(0);
		expect(rang('Bijlage')).toBe(0);
		expect(rang('Nota n.a.v. het (nader/tweede nader/enz.) verslag')).toBe(0);
		expect(rang('Brief regering')).toBe(1);
		expect(rang('Geleidende brief')).toBe(2);
	});
});
