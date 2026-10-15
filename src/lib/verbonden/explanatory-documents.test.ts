import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { rowsOfExplanations, mergeExplanatory } from './explanatory-documents';
import { type Neighbor } from '$lib/api/nodes';

type Item = Schema<'ArticleExplanationDTO'>;

const item = (key: string, scope: Item['scope'], section_anchor: string | null): Item =>
	({
		document: {
			id: `documents/${key}`,
			key,
			is_explanatory: true,
			title: 'Verklaring dat er grond bestaat een voorstel in overweging te nemen',
			kind: 'Memorie van toelichting',
			dossier_number: '33989',
			path: null
		},
		target: 'article_version',
		target_id: 'article_versions/bwbr0001840_av_2990163_28852472',
		article_version_key: 'bwbr0001840_av_2990163_28852472',
		confidence: 0.9,
		scope,
		section_anchor,
		article_id: 'articles/bwbr0001840_13'
	}) as Item;

describe('rowsOfExplanations', () => {
	it('keeps the memorie of the first reading at its section, and leaves the second out', () => {
		const rows = rowsOfExplanations([
			item('second', 'dossier', null),
			item('first', 'article', 's-40')
		]);
		expect(rows.map((r) => r.ref.key)).toEqual(['first']);
		// `s-40` is the id of a section: the reader opens there, but it is no § number.
		expect(rows[0]).toMatchObject({ at: 's-40', position: null });
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
