// Guard: one verbinding says the same words in the row's card, the table, the CSV and the legend
// (relation-words.ts), and the card reads where the verbinding comes from from the edge.
import { describe, expect, it } from 'vitest';
import type { GraphNode } from '$lib/graph/types';
import type { Group } from './groups';
import { rowsToCsv } from './export';
import type { Row } from './rows';
import { relationCounts, rowLabel } from './view';
import { betrouwbaarheid, verbindingOfRow } from './verbinding';

const artikel: GraphNode = {
	id: 'articles/bwbr0005537_3_2',
	collection: 'articles',
	key: 'bwbr0005537_3_2',
	drawClass: 'article',
	label: 'Artikel 3:2 Awb'
};

const uitspraak: Row = {
	ref: { collection: 'judgments', key: 'ecli_nl_rvs_2015_41' },
	title: 'Raad van State, 21\u00a0januari\u00a02015',
	context: null,
	filterGroup: 'uitspraken',
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
			'de verwijzing staat letterlijk in de tekst'
		);
		// A reference read from the XML of wetten.overheid.nl is no recognition.
		expect(betrouwbaarheid(1, false, 'bwb_xml_ref').why).toBe('uit de bron, wetten.overheid.nl');
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
			filterGroup: 'artikelen'
		};
		const groep = { id: 'g', label: 'g', rows: [uitspraak, verwijzend], capped: false } as Group;
		expect(relationCounts([groep], 'articles')[0].label).toBe('haalt aan, verwijst naar');
	});
});
