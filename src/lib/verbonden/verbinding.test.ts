// Guard: one verbinding says the same words in the row's card, the table, the CSV, the legend
// and on the canvas (hoe.ts), and the card reads where the verbinding comes from from the edge.
import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode } from '$lib/graph/types';
import type { Group } from './groups';
import { rowsToCsv } from './export';
import { relationLabel } from './hoe';
import type { Row } from './rows';
import { relationCounts, rowLabel } from './view';
import { fakeApi } from '$lib/test/fakeApi';
import { rowsOfCitedBy } from './cited-by';
import { edgeKey } from './edge-meta';
import {
	betrouwbaarheid,
	edgeLids,
	kaartMetPassages,
	toontStatus,
	verbindingOfEdge,
	verbindingOfRow
} from './verbinding';

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

// UX-toets 14 Oct, #49: RBDHA 2013:19764 cites art. 126ffa Sv five times, the first without a
// lid. The canvas has the edge's light meta only ({ reason, mention_count }); the row reads
// the places from `cited-by`.
describe('the card and line of a judgment that cites an article (#49)', () => {
	const rb: GraphNode = {
		id: 'judgments/ecli_nl_rbdha_2013_19764',
		collection: 'judgments',
		key: 'ecli_nl_rbdha_2013_19764',
		kind: 'judgment',
		label: 'Rb. Den Haag',
		raw: {
			display_name: 'Rechtbank Den Haag 2013-01-01 / 000000-00',
			props: { ecli: 'ECLI:NL:RBDHA:2013:19764', court: 'RBDHA', date: '2013-01-01' }
		} as unknown as GraphNode['raw']
	};
	const art: GraphNode = {
		id: 'articles/bwbr0001903_126ffa',
		collection: 'articles',
		key: 'bwbr0001903_126ffa',
		kind: 'article',
		label: 'Art. 126ffa',
		raw: {
			display_name: 'Artikel 126ffa Wetboek van Strafvordering',
			props: { bwb_id: 'BWBR0001903', article_number: '126ffa' }
		} as unknown as GraphNode['raw']
	};
	const edge: GraphEdge = {
		id: 'e',
		source: rb.id,
		target: art.id,
		relation: 'REFERS_TO',
		label: '',
		directed: true,
		status: 'canoniek',
		meta: { reason: 'bwb_article', mention_count: 5 }
	};
	const judgment = {
		key: rb.key,
		ecli: 'ECLI:NL:RBDHA:2013:19764',
		court: 'RBDHA',
		date: '2013-01-01',
		display_name: 'Rechtbank Den Haag 2013-01-01 / 000000-00'
	};
	const passage = (leden: string[], text: string, paragraph_id: string) => ({
		leden,
		judgment,
		paragraph_id,
		paragraph_number: null,
		qualifier: leden.length ? `lid ${leden[0]}` : null,
		text,
		snippet: text,
		confidence: 0.95
	});
	const citedBy = {
		total: 3,
		judgment_total: 1,
		echr_judgment_total: 0,
		items: [
			passage([], 'artikel 126ffa Wetboek van Strafvordering', 'p-1'),
			passage(['1'], 'artikel 126ffa lid 1 Sv', 'p-2'),
			passage(['4'], 'artikel 126ffa lid 4 Sv', 'p-3')
		]
	};

	it('names the judgment as its row does, never by its raw name', () => {
		expect(verbindingOfEdge(edge, rb, art).from.title).toBe('Rechtbank Den Haag, 1 januari 2013');
	});

	it('gives the card the lid of the row: the same summary of every place', async () => {
		fakeApi({ '/api/articles/{bwb_id}/{article_number}/cited-by': citedBy });
		const v = await kaartMetPassages(verbindingOfEdge(edge, rb, art), rb, art);
		const [row] = rowsOfCitedBy(citedBy.items as never);
		expect(row.lid).toBe('1');
		expect(v.lid).toBe(row.lid);
		expect(v.to.sub).toBe('lid 1');
	});

	it('gives the line the lid of the row or of the card', () => {
		const [row] = rowsOfCitedBy(citedBy.items as never);
		const lids = edgeLids([row], art.id);
		expect(lids.get(edgeKey(rb.id, art.id, 'REFERS_TO'))).toBe('1');
	});
});
