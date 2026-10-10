import { describe, expect, it } from 'vitest';
import type { InstrumentMeta } from '$lib/api/instrument-cache';
import type { GraphNode } from '$lib/graph/types';
import { bronNaam, stemmingNaam } from './naam';

const awb: InstrumentMeta = {
	bwbId: 'BWBR0005537',
	title: 'Algemene wet bestuursrecht',
	shortTitle: 'Awb',
	citationTitle: 'Algemene wet bestuursrecht'
};
const meta = new Map([[awb.bwbId, awb]]);

const node = (n: Partial<GraphNode> & Pick<GraphNode, 'collection' | 'kind'>): GraphNode =>
	({ id: `${n.collection}/x`, key: 'x', label: 'x', ...n }) as GraphNode;

describe('bronNaam', () => {
	it('names an article with the short title of its law', () => {
		const art = node({
			collection: 'articles',
			kind: 'article',
			label: 'Art. 3:4',
			raw: { props: { bwb_id: 'BWBR0005537' } } as unknown as GraphNode['raw']
		});
		expect(bronNaam(art, meta)).toBe('Art. 3:4 Awb');
	});

	it('keeps an article without a known law as it is', () => {
		const art = node({ collection: 'articles', kind: 'article', label: 'Art. 1' });
		expect(bronNaam(art, meta)).toBe('Art. 1');
	});

	it('names an article by the law it carries until the short title is in', () => {
		const art = node({
			collection: 'articles',
			kind: 'article',
			label: 'Art. 419',
			raw: {
				props: {
					bwb_id: 'BWBR0001827',
					instrument_citation_title: 'Wetboek van Burgerlijke Rechtsvordering'
				}
			} as unknown as GraphNode['raw']
		});
		expect(bronNaam(art, meta)).toBe('Art. 419 Wetboek van Burgerlijke Rechtsvordering');
	});

	it('names a law by its short title', () => {
		const law = node({
			collection: 'instruments',
			kind: 'instrument',
			label: 'BWBR0005537',
			raw: { props: { bwb_id: 'BWBR0005537' } } as unknown as GraphNode['raw']
		});
		expect(bronNaam(law, meta)).toBe('Awb');
	});

	it('names a judgment as Verbonden does: court and date', () => {
		const j = node({
			collection: 'judgments',
			kind: 'judgment',
			label: 'RvS 2023/93',
			raw: {
				props: { court: 'Raad van State', date: '2023-01-11', ecli: 'ECLI:NL:RVS:2023:93' }
			} as unknown as GraphNode['raw']
		});
		expect(bronNaam(j, meta)).toBe('Raad van State, 11 januari 2023');
	});
});

describe('stemmingNaam', () => {
	const vote = (key: string, props: Record<string, unknown>) =>
		({
			id: `decisions/${key}`,
			label: 'Wetgeving 2025Z15911: Wijziging van de Wet SUWI',
			raw: { props }
		}) as unknown as GraphNode;

	it('names a vote as the procedure does, not by its zaak number', () => {
		expect(
			stemmingNaam(
				vote('abc', {
					date: '2026-09-29',
					subject: 'Wijziging van de Wet SUWI ',
					decision_kind: 'Stemmen - aangenomen',
					kind: 'Wetgeving',
					passed: true
				})
			)
		).toBe('Stemming Tweede Kamer, aangenomen, 29 september 2026: Wijziging van de Wet SUWI');
	});

	it('says a postponed vote and a vote of the Eerste Kamer in their own words', () => {
		expect(stemmingNaam(vote('abc', { decision_kind: 'Stemmen - uitstellen', passed: null }))).toBe(
			'Stemming Tweede Kamer, uitstellen'
		);
		expect(stemmingNaam(vote('ek_36799', { passed: false }))).toBe(
			'Stemming Eerste Kamer, verworpen'
		);
	});
});
