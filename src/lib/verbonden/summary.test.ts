import { describe, expect, it } from 'vitest';
import { bucketKey } from '$lib/api/nodes';
import { GROUPS, buildGroups, type Group } from './groups';
import { kindOfGroup, kindsOf, kindsTotal, shortLine } from './summary';
import type { Row } from './rows';

const row = (
	collection: 'judgments' | 'documents' | 'articles',
	key: string,
	more: Partial<Row> = {}
): Row => ({
	ref: { collection, key },
	title: key,
	context: null,
	filterGroup: 'uitspraken',
	...more
});

const groupsOf = (rows: Record<string, Row[]>, totals: Record<string, number> = {}): Group[] =>
	buildGroups('articles', []).map((g) => ({
		...g,
		rows: rows[g.id] ?? [],
		total: totals[g.id] ?? rows[g.id]?.length ?? 0
	}));

describe('Verbonden at a glance', () => {
	it('counts a soort over the whole, as the API counts its buckets, the kern left out', () => {
		const groups = groupsOf(
			{ judgments: [row('judgments', 'a')], documents: [row('documents', 'b')] },
			{ judgments: 10394 }
		);
		const buckets = new Map([
			[bucketKey('REFERS_TO', 'judgments', 'inbound'), 10394],
			[bucketKey('REFERS_TO', 'documents', 'inbound'), 132],
			// The law of the article is its kern: no soort of Verbonden.
			[bucketKey('PART_OF', 'instruments', 'outbound'), 1],
			[bucketKey('VERSION_OF', 'article_versions', 'inbound'), 1]
		]);
		const kinds = kindsOf(groups, 'articles', buckets);
		expect(kinds.map((k) => [k.label, k.count])).toEqual([
			['Uitspraken', 10394],
			['Stukken', 132]
		]);
		expect(kindsTotal(kinds)).toBe(10526);
	});

	it('orders the soorten as the mockup of each kind of bron does', () => {
		const dossier = kindsOf(
			[
				{ id: 'd', label: 'D', rows: [row('documents', 'x')], total: 3, capped: false },
				{ id: 'l', label: 'L', rows: [row('articles', 'y')], total: 1, capped: false }
			] as Group[],
			'dossiers',
			null
		);
		expect(dossier.map((k) => k.label)).toEqual(['Wetten', 'Stukken']);
	});

	it('says a judgment by where and how often it is cited, a Kamerstuk by its kind and day', () => {
		expect(
			shortLine(
				row('judgments', 'j', { position: 'r.o. 3.4', props: { inbound_citation_count: 168 } })
			)
		).toBe('r.o. 3.4, 168 keer aangehaald');
		expect(
			shortLine(
				row('documents', 'k', {
					title: 'Kamerstuk 32426, nr. 3',
					date: '2010-06-22',
					props: { kind: 'Memorie van toelichting' }
				})
			)
		).toBe('Memorie van toelichting, 22\u00a0jun.\u00a02010');
		expect(
			shortLine(
				row('documents', 'k', {
					title: 'Memorie van toelichting, Kamerstukken II',
					props: { kind: 'Memorie van toelichting (initiatiefvoorstel)' }
				})
			)
		).toBe('');
	});

	// The guard: a group of Verbonden whose bronnen the table names stands under a soort, so
	// nothing of Verbonden falls out of the summary (T5: a Kamerlid's besluiten were missing).
	it('puts every group whose collection is known under a soort', () => {
		const loose = Object.entries(GROUPS).flatMap(([c, gs]) =>
			(gs ?? [])
				.filter(
					(g) =>
						(g.match?.length || g.bakken?.length) && !kindOfGroup({ ...g, rows: [], capped: false })
				)
				.map((g) => `${c}/${g.id}`)
		);
		expect(loose).toEqual([]);
	});
});
