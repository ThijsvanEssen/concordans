// Guard: the row in Verbonden and the card of the same line on the canvas read one edge's
// meta alike: the same lid, place, passage and phrase (code-eenvoud F15).
import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode } from '$lib/graph/types';
import { rowOfNeighbor } from './rows';
import { type Neighbor } from '$lib/api/nodes';
import { verbindingOfEdge, verbindingOfRow } from './verbinding';
import { parseOutcome, readEdge, readTranspositionOutcome } from './edge-meta';

const artikel: GraphNode = {
	id: 'articles/bwbr0005537_3_2',
	collection: 'articles',
	key: 'bwbr0005537_3_2',
	drawClass: 'article',
	label: 'Artikel 3:2 Awb'
};

const kamerstuk: GraphNode = {
	id: 'documents/kst-36000-3',
	collection: 'documents',
	key: 'kst-36000-3',
	drawClass: 'document',
	label: 'Memorie van toelichting'
};

const uitspraak: GraphNode = {
	id: 'judgments/ecli_nl_hr_2019_2006',
	collection: 'judgments',
	key: 'ecli_nl_hr_2019_2006',
	drawClass: 'judgment',
	label: 'HR 20\u00a0december\u00a02019',
	raw: { props: { ecli: 'ECLI:NL:HR:2019:2006' } } as unknown as GraphNode['raw']
};

const snippet = 'Zie HR 23\u00a0september\u00a01988, ECLI:NL:HR:1988:AD5713 (Kalimijnen).';
const words = 'ECLI:NL:HR:1988:AD5713';

const cases: { name: string; from: GraphNode; meta: Record<string, unknown> }[] = [
	{
		name: 'a Kamerstuk whose phrase alone names the lid',
		from: kamerstuk,
		meta: { raw_match: 'artikel 3:2, tweede lid, Awb', snippet: 'Op grond van artikel 3:2' }
	},
	{
		name: 'a Kamerstuk with only a qualifier',
		from: kamerstuk,
		meta: { qualifier: 'derde lid' }
	},
	{
		name: 'the leden the edge lists',
		from: kamerstuk,
		meta: { leden: ['4', '5'], lid: '6', raw_match: 'tweede lid' }
	},
	{
		name: 'a Kamerstuk citing in a note',
		from: kamerstuk,
		meta: { place: { part: 'footnote', start: 0, end: 40, footnote: '77', footnote_id: 'fn-77' } }
	},
	{
		name: 'a judgment’s passage in a note',
		from: uitspraak,
		meta: {
			passages: [
				{
					paragraph_id: 'rov-5.7.6',
					paragraph_number: '5.7.6',
					footnote: '35',
					snippet,
					text: words,
					start: snippet.indexOf(words),
					end: snippet.indexOf(words) + words.length
				}
			]
		}
	},
	{
		name: 'a judgment’s overwegingen',
		from: uitspraak,
		meta: { paragraphs: ['6', '7'], reason: 'bwb_article' }
	}
];

describe('one edge, read alike by the row and the canvas card', () => {
	for (const c of cases) {
		it(c.name, () => {
			const neighbor = {
				collection: c.from.collection,
				key: c.from.key,
				display_name: c.from.label,
				props: c.from.raw?.props ?? {},
				meta: c.meta,
				relation: 'REFERS_TO',
				direction: 'inbound',
				confidence: 0.95,
				status: 'vastgesteld',
				edge_id: null
			} as unknown as Neighbor;
			const fromRow = verbindingOfRow(rowOfNeighbor(neighbor)!, artikel)!;
			const edge: GraphEdge = {
				id: 'e',
				source: c.from.id,
				target: artikel.id,
				relation: 'REFERS_TO',
				label: '',
				directed: true,
				status: 'vastgesteld',
				confidence: 0.95,
				meta: c.meta
			};
			const onCanvas = verbindingOfEdge(edge, c.from, artikel);
			const pick = (v: typeof fromRow) => ({
				lid: v.lid,
				position: v.position,
				snippet: v.snippet,
				match: v.match,
				noot: v.noot,
				bereik: v.bereik,
				reason: v.reason,
				derived: v.derived
			});
			expect(pick(onCanvas)).toEqual(pick(fromRow));
		});
	}

	it('reads the lid from the leden, then the lid, then the phrase', () => {
		const lid = (meta: Record<string, unknown>) =>
			readEdge(meta, { direction: 'inbound', citingEcli: null }).lid;
		expect(lid({ leden: ['4'], lid: '6', raw_match: 'tweede lid' })).toBe('4');
		expect(lid({ lid: '6', raw_match: 'tweede lid' })).toBe('6');
		expect(lid({ raw_match: 'tweede lid' })).toBe('2');
		expect(lid({ qualifier: 'derde lid' })).toBe('3');
		// Of an outbound edge the phrase names the other end's lid, not the selected one's.
		expect(
			readEdge({ raw_match: 'tweede lid' }, { direction: 'outbound', citingEcli: null }).lid
		).toBe(null);
	});

	it('cites r.o. 6 and 7 with the anchor of the first', () => {
		const e = readEdge(
			{ paragraphs: ['6', '7'] },
			{ direction: 'inbound', citingEcli: 'ECLI:NL:HR:2019:2006' }
		);
		expect([e.position, e.at]).toEqual(['r.o. 6 en 7', 'rov-6']);
	});
});

describe('readTranspositionOutcome (lawgraph #860)', () => {
	it('reads what the table says of an old article it places in no article', () => {
		expect(parseOutcome('vervallen')).toEqual({ kind: 'vervallen', law: null });
		expect(parseOutcome('niet_overgenomen')).toEqual({ kind: 'niet_overgenomen', law: null });
		expect(parseOutcome('blijft_in:Waterwet')).toEqual({ kind: 'blijft_in', law: 'Waterwet' });
		expect(parseOutcome('gat')).toEqual({ kind: 'gat', law: null });
		expect(parseOutcome('iets nieuws')).toBeNull();
	});

	it('reads the other law a part goes to without an article (lawgraph #879)', () => {
		expect(parseOutcome('naar:Gratiewet')).toEqual({ kind: 'naar', law: 'Gratiewet' });
		expect(parseOutcome('naar:Wetboek van Strafrecht')).toEqual({
			kind: 'naar',
			law: 'Wetboek van Strafrecht'
		});
		expect(parseOutcome('naar:')).toBeNull();
		expect(
			readTranspositionOutcome({
				outcome: 'naar:Omgevingswet',
				parts: [{ from: '', to: 'later', outcome: 'naar:Omgevingswet' }]
			}).parts
		).toEqual([{ from: '', to: 'later', outcome: { kind: 'naar', law: 'Omgevingswet' } }]);
		expect(parseOutcome(undefined)).toBeNull();
	});

	it('reads the parts, each with its own outcome, and the source', () => {
		expect(
			readTranspositionOutcome({
				basis: 'transposition_table',
				source: 'blg-1081574',
				outcome: 'gat',
				parts: [
					{ from: '1', to: 'vervallen (mvt)', outcome: 'vervallen' },
					{ from: '2', to: 'Besluit B2', outcome: 'gat' }
				]
			})
		).toEqual({
			outcome: { kind: 'gat', law: null },
			parts: [
				{ from: '1', to: 'vervallen (mvt)', outcome: { kind: 'vervallen', law: null } },
				{ from: '2', to: 'Besluit B2', outcome: { kind: 'gat', law: null } }
			],
			source: 'blg-1081574'
		});
		expect(readTranspositionOutcome(null)).toEqual({ outcome: null, parts: [], source: null });
	});
});
