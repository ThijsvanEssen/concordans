// Guard: one verbinding says the same words in the row's card, the table, the CSV, the legend
// and on the canvas (hoe.ts), and the card reads where the verbinding comes from from the edge.
import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode } from '$lib/graph/types';
import type { Group } from './groups';
import { rowsToCsv } from './export';
import { relationLabel } from './hoe';
import type { Row } from './rows';
import { relationCounts, rowLabel } from './view';
import { betrouwbaarheid, toontStatus, verbindingOfEdge, verbindingOfRow } from './verbinding';

const artikel: GraphNode = {
	id: 'articles/bwbr0005537_3_2',
	collection: 'articles',
	key: 'bwbr0005537_3_2',
	kind: 'article',
	label: 'Artikel 3:2 Awb'
};

const uitspraak: Row = {
	ref: { collection: 'judgments', key: 'ecli_nl_rvs_2015_41' },
	title: 'Raad van State, 21 januari 2015',
	context: null,
	kind: 'uitspraken',
	relation: 'REFERS_TO',
	direction: 'inbound',
	confidence: 0.95,
	// The node's props carry no reason; the edge does.
	props: { ecli: 'ECLI:NL:RVS:2015:41' },
	edge: { reason: 'bwb_article', paragraphs: ['6'] }
};

describe('verbindingOfRow', () => {
	it('reads where the verbinding comes from from the edge, not from the props', () => {
		const v = verbindingOfRow(uitspraak, artikel)!;
		expect(v.reason).toBe('bwb_article');
		expect(betrouwbaarheid(v.confidence, v.derived, v.reason).why).toBe(
			'de verwijzing is als geheel herkend in de tekst'
		);
		// A reference read from the XML of wetten.overheid.nl is no recognition.
		expect(betrouwbaarheid(1, false, 'bwb_xml_ref').why).toBe(
			'verwijzing in de wettekst, wetten.overheid.nl'
		);
	});

	it('says the words of the row, the table, the CSV and the legend', () => {
		const v = verbindingOfRow(uitspraak, artikel)!;
		const woord = rowLabel(uitspraak, 'articles');
		expect(woord).toBe('haalt aan');
		expect(v.label).toBe(woord);
		expect(v.kind).toBe('verwijzing in een uitspraak');
		expect(rowsToCsv([uitspraak], 'articles', 'https://x').split('\r\n')[1]).toContain(
			`;${woord};`
		);
		const groep = { id: 'g', label: 'g', rows: [uitspraak], capped: false } as Group;
		expect(relationCounts([groep], 'articles')).toEqual([
			{ relation: 'REFERS_TO', label: woord, count: 1 }
		]);
	});

	it('names in the legend every word a relation has on the page', () => {
		const verwijzend: Row = {
			...uitspraak,
			ref: { collection: 'articles', key: 'bwbr0001_5' },
			kind: 'artikelen'
		};
		const groep = { id: 'g', label: 'g', rows: [uitspraak, verwijzend], capped: false } as Group;
		expect(relationCounts([groep], 'articles')[0].label).toBe('haalt aan, verwijst naar');
	});
});

describe('verbindingOfEdge', () => {
	it('says what the canvas line says', () => {
		const motie: GraphNode = {
			id: 'documents/b',
			collection: 'documents',
			key: 'b',
			kind: 'document',
			label: 'Bijlage'
		};
		const brief: GraphNode = { ...motie, id: 'documents/a', key: 'a', label: 'Brief' };
		const edge: GraphEdge = {
			id: 'e',
			source: motie.id,
			target: brief.id,
			relation: 'ACCOMPANIES',
			label: '',
			directed: true,
			status: 'vastgesteld'
		};
		const v = verbindingOfEdge(edge, motie, brief);
		expect([v.label, v.kind]).toEqual(['bijlage bij', 'bijlage bij een brief']);
		expect(v.label).toBe(relationLabel('ACCOMPANIES', 'documents', 'documents'));
		// A parliamentary verbinding has no status worth saying.
		expect(toontStatus(v)).toBe(false);
		expect(toontStatus({ relation: 'AMENDS', status: 'vastgesteld' })).toBe(true);
		expect(toontStatus({ relation: 'REFERS_TO', status: 'voorgesteld' })).toBe(true);
	});
});
