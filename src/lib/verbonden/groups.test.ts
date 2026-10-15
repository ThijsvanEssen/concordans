import { describe, expect, it } from 'vitest';
import {
	ditVan,
	naarSoort,
	buildGroups,
	countLabel,
	GROUPS,
	withUnresolvedAppeals
} from './groups';
import { isInternational } from './filter';
import { metaParts, describe as describeBron } from './rows';
import { type Neighbor } from '$lib/api/nodes';
import node36327 from '$lib/fixtures/node-dossier-36327.json';
import { type Collection, type Relation } from '$lib/vocabulary';

const neighbors = (fixture: { neighbors: { all: unknown[] } }) =>
	fixture.neighbors.all as Neighbor[];

describe('naarSoort', () => {
	const groups = [
		{ label: 'Artikelen van deze wet' },
		{ label: 'Wetten die met deze wet verbonden zijn' }
	];
	it('names a richtlijn and a verdrag by their kind', () => {
		expect(
			naarSoort(groups, { jurisdiction: 'eu', citation_title: 'Richtlijn (EU) 2017/1132' }).map(
				(g) => g.label
			)
		).toEqual(['Artikelen van deze richtlijn', 'Wetten die met deze richtlijn verbonden zijn']);
		expect(naarSoort(groups, { kind: 'multilateraalverdrag' })[0].label).toBe(
			'Artikelen van dit verdrag'
		);
	});
	it('names an AMvB a besluit and a ministerial regulation a regeling', () => {
		expect(naarSoort([{ label: 'Grondslag van deze wet' }], { kind: 'AMvB' })[0].label).toBe(
			'Grondslag van dit besluit'
		);
		expect(ditVan({ kind: 'ministeriele-regeling' })).toBe('deze regeling');
		expect(ditVan({ kind: 'wet' })).toBeNull();
	});
	it('keeps a wet and a regeling as they are', () => {
		expect(naarSoort(groups, { kind: 'wet' })).toEqual(groups);
		expect(naarSoort(groups, {})).toEqual(groups);
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

	it('lists the fracties that voted Voor first, then Tegen, the most seats first (#83)', () => {
		const vote = (key: string, choice: string, seats: number) =>
			({
				id: `factions/${key}`,
				key,
				collection: 'factions',
				display_name: key,
				relation: 'VOTED',
				direction: 'inbound',
				props: {},
				meta: { choice, seats }
			}) as unknown as Neighbor;
		const rows = buildGroups('decisions', [
			vote('sp', 'Tegen', 3),
			vote('markuszower', 'Voor', 7),
			vote('pvv', 'Tegen', 26),
			vote('cu', 'Voor', 3)
		]).find((g) => g.id === 'votes')!.rows;
		expect(rows.map((r) => r.ref.key)).toEqual(['markuszower', 'cu', 'pvv', 'sp']);
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

// The endpoints of each relation, as the API defines them (lawgraph core/relations.py), as
// pairs of sources and targets where a relation joins only some of them. A bron of a kind
// the panel shows gets each relation it can have in a group of its own, also when another
// kind of bron already has one for it: the group "Andere verbindingen" stays for relations
// the API adds later.
type Ends = [Collection[], Collection[]];
const ENDS: Record<Relation, Ends | Ends[]> = {
	PART_OF: [
		['articles', 'annexes', 'documents', 'cases'],
		['instruments', 'cases', 'dossiers']
	],
	VERSION_OF: [
		['instrument_versions', 'article_versions'],
		['instruments', 'articles']
	],
	ESTABLISHES: [['instruments'], ['articles']],
	AMENDS: [
		['instruments', 'documents'],
		['instruments', 'articles']
	],
	INTRODUCES: [
		['instruments', 'documents'],
		['instruments', 'articles']
	],
	REPEALS: [
		['instruments', 'documents'],
		['instruments', 'articles']
	],
	BASED_ON: [['instruments'], ['articles']],
	IMPLEMENTS: [['instruments'], ['instruments']],
	LEGISLATED_IN: [['instruments'], ['dossiers']],
	PUBLISHED_IN: [['instruments'], ['instruments']],
	REFERS_TO: [
		[
			['articles', 'documents', 'judgments'],
			['articles', 'instruments', 'judgments']
		],
		[['documents'], ['documents']]
	],
	EXPLAINS: [['documents'], ['article_versions', 'articles', 'instruments']],
	APPEAL_OF: [['judgments'], ['judgments']],
	ADVISES_ON: [['judgments'], ['judgments']],
	ANSWERS: [
		[['judgments'], ['judgments']],
		[['documents'], ['commitments', 'documents']]
	],
	CONTINUES: [['judgments'], ['judgments']],
	REFERRED_BY: [['judgments'], ['judgments']],
	SAME_AS: [['judgments'], ['judgments']],
	SCOPED_BY: [['articles'], ['annexes']],
	ABOUT: [
		['activities', 'decisions', 'commitments'],
		['cases', 'dossiers']
	],
	LED_BY: [['activities'], ['committees']],
	MADE_IN: [['commitments', 'documents', 'decisions'], ['activities']],
	MEMBER_OF: [['members'], ['committees', 'factions']],
	SERVED_IN: [['members'], ['cabinets']],
	AUTHORED: [['members'], ['documents', 'cases']],
	RELATED_TO: [
		[['dossiers'], ['dossiers']],
		[['judgments'], ['judgments']],
		[['cases'], ['cases']]
	],
	REVISES: [
		[['dossiers'], ['dossiers']],
		[['documents'], ['documents']]
	],
	ACCOMPANIES: [
		[['dossiers'], ['dossiers']],
		[['documents'], ['documents']]
	],
	SECOND_READING_OF: [['dossiers'], ['dossiers']],
	VOTED: [['members', 'factions'], ['decisions']]
};

const neighbor = (
	relation: Relation,
	direction: 'inbound' | 'outbound',
	collection: Collection
): Neighbor =>
	({
		id: `${collection}/x`,
		key: 'x',
		collection,
		relation,
		direction,
		props: {}
	}) as unknown as Neighbor;

const pairs = (ends: Ends | Ends[]): Ends[] =>
	Array.isArray(ends[0][0]) ? (ends as Ends[]) : [ends as Ends];

describe('every relation of the API', () => {
	const cases: [Collection, Relation, 'inbound' | 'outbound', Collection][] = [];
	for (const [relation, ends] of Object.entries(ENDS) as [Relation, Ends | Ends[]][])
		for (const [from, to] of pairs(ends))
			for (const source of from)
				for (const target of to) {
					if (source in GROUPS) cases.push([source, relation, 'outbound', target]);
					if (target in GROUPS) cases.push([target, relation, 'inbound', source]);
				}

	it.each(cases)('%s: %s %s from %s has a group of its own', (bron, relation, direction, other) => {
		const groups = buildGroups(bron, [neighbor(relation, direction, other)]);
		expect(groups.find((g) => g.id === 'other')?.rows ?? []).toEqual([]);
	});
});

// A known relation no group matches is left out without a word. Between Kamerstukken and
// toezeggingen each end shows the other, in a group of its own (PR #595: the papers a
// subject names; the letter that fulfils a toezegging).
describe('the verbindingen between Kamerstukken and toezeggingen', () => {
	const cases: [Collection, Relation, 'inbound' | 'outbound', Collection, string][] = [
		['documents', 'ANSWERS', 'outbound', 'documents', 'answers'],
		['documents', 'ANSWERS', 'inbound', 'documents', 'answered-by'],
		['documents', 'ANSWERS', 'outbound', 'commitments', 'fulfils'],
		['commitments', 'ANSWERS', 'inbound', 'documents', 'fulfilled-by'],
		['documents', 'REFERS_TO', 'outbound', 'documents', 'names'],
		['documents', 'REFERS_TO', 'inbound', 'documents', 'named-by']
	];
	it.each(cases)('%s: %s %s from %s stands in %s', (bron, relation, direction, other, id) => {
		const groups = buildGroups(bron, [neighbor(relation, direction, other)]);
		expect(groups.filter((g) => g.rows.length).map((g) => g.id)).toEqual([id]);
	});
});
