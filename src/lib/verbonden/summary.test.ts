import { describe, expect, it } from 'vitest';
import { bucketKey } from '$lib/api/nodes';
import { GROUPS, buildGroups, type Group } from './groups';
import { kindOfGroup, kindsOf, kindsTotal, previewPerSoort, shortLine } from './summary';
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

describe('the regulations issued under a law', () => {
	const regulation = (key: string, more: Partial<Row> = {}): Row => ({
		ref: { collection: 'instruments', key },
		title: key,
		context: null,
		filterGroup: 'wetten',
		relation: 'BASED_ON',
		direction: 'inbound',
		date: '2026-08-15',
		props: { kind: 'amvb' },
		...more
	});
	const law = (key: string): Row => ({
		ref: { collection: 'instruments', key },
		title: key,
		context: null,
		filterGroup: 'wetten'
	});
	const groups = (): Group[] =>
		buildGroups('instruments', []).map((g) => ({
			...g,
			rows:
				g.id === 'based-on'
					? [
							regulation('cbb'),
							regulation('regeling', { ['onder']: 'cbb', props: { kind: 'ministeriele-regeling' } })
						]
					: g.id === 'related'
						? [law('nis')]
						: [],
			total: g.id === 'based-on' ? 2 : g.id === 'related' ? 1 : 0
		}));

	it('are a soort of their own, before the laws that cite or are cited', () => {
		const kinds = kindsOf(groups(), 'instruments', new Map());
		expect(kinds.map((k) => [k.id, k.label, k.count])).toEqual([
			['regelingen', 'Uitvoeringsregelingen', 2],
			['laws', 'Wetten', 1]
		]);
		expect(kinds[0].noun).toBe('uitvoeringsregelingen');
	});

	it('hold those issued under another right under it, as many rows as they count', () => {
		const [regelingen] = kindsOf(groups(), 'instruments', new Map());
		expect(regelingen.rows.map((r) => r.ref.key)).toEqual(['cbb', 'regeling']);
		expect(regelingen.rows.length).toBe(regelingen.count);
	});

	it('say their kind and day in the overview', () => {
		expect(shortLine(regulation('cbb')).replace(/\s/g, ' ')).toBe('AMvB, 15 aug. 2026');
	});

	it('count what their loader brings, not the edges of the bucket, once it is in', () => {
		const buckets = new Map([[bucketKey('BASED_ON', 'instruments', 'inbound'), 5]]);
		const g = buildGroups('articles', []).map((x) => ({
			...x,
			rows: x.id === 'based-on' ? [regulation('cbb')] : [],
			total: x.id === 'based-on' ? 1 : 0
		}));
		const kinds = kindsOf(g, 'articles', buckets);
		expect(kinds.map((k) => [k.id, k.count])).toEqual([['regelingen', 1]]);
		const laden = g.map((x) => (x.id === 'based-on' ? { ...x, laden: true } : x));
		expect(kindsOf(laden, 'articles', buckets).map((k) => [k.id, k.count])).toEqual([
			['regelingen', 5]
		]);
	});
});

describe('Verbonden at a glance', () => {
	it('counts a soort over the whole, as its groups count their buckets, the kern left out', () => {
		const groups = groupsOf(
			{ judgments: [row('judgments', 'a')], documents: [row('documents', 'b')] },
			{ judgments: 10394, documents: 132 }
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

	it('counts the wetten of a dossier by its rows, not by the bucket that holds the Staatsblad too', () => {
		const wet: Row = {
			...row('articles', 'bwbr0049889'),
			ref: { collection: 'instruments', key: 'bwbr0049889' }
		};
		const buckets = new Map([[bucketKey('LEGISLATED_IN', 'instruments', 'inbound'), 2]]);
		const laws = (extra: Partial<Group>) =>
			[
				{
					id: 'laws',
					label: 'Wet',
					rows: [wet],
					capped: false,
					...extra
				}
			] as Group[];
		expect(kindsOf(laws({}), 'dossiers', buckets)[0].count).toBe(1);
		// While its loader runs, the bucket still stands for it.
		expect(kindsOf(laws({ laden: true }), 'dossiers', buckets)[0].count).toBe(2);
	});

	it('counts the dossiers of a ministry by the open ones its loader lists, not by every edge', () => {
		const buckets = new Map([[bucketKey('LED_BY', 'dossiers', 'inbound'), 249]]);
		const open = (extra: Partial<Group>) =>
			[
				{
					id: 'dossiers',
					label: 'Openstaande dossiers',
					rows: [{ ...row('documents', 'd1'), ref: { collection: 'dossiers', key: 'd1' } } as Row],
					total: 39,
					capped: false,
					countsOpenOnly: true,
					...extra
				}
			] as Group[];
		expect(kindsOf(open({}), 'ministries', buckets)[0].count).toBe(39);
		// While it loads the buckets, which hold the finished dossiers too, do not stand for it: no number yet.
		const laden = kindsOf(open({ laden: true, rows: [], total: undefined }), 'ministries', buckets);
		expect(laden).toEqual([]);
	});

	it('orders the soorten as the mockup of each kind of bron does', () => {
		const dossier = kindsOf(
			[
				{ id: 'd', label: 'D', rows: [row('documents', 'x')], total: 3, capped: false },
				{
					id: 'l',
					label: 'L',
					rows: [{ ...row('articles', 'y'), ref: { collection: 'instruments', key: 'y' } }],
					total: 1,
					capped: false
				}
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

describe('the laws of a bron, each in its soort (T11)', () => {
	const inst = (key: string, more: Partial<Row> = {}): Row => ({
		ref: { collection: 'instruments', key },
		title: key,
		context: null,
		filterGroup: 'wetten',
		...more
	});
	const groups = (): Group[] =>
		buildGroups('instruments', []).map((g) => ({
			...g,
			rows:
				g.id === 'international'
					? [
							inst('32019l0001', { props: { celex: '32019L0001' }, date: '2019-01-01' }),
							inst('32022l2555', {
								props: { celex: '32022L2555' },
								date: '2022-12-14',
								relation: 'IMPLEMENTS'
							}),
							inst('32020r0001', { props: { celex: '32020R0001' }, date: '2020-01-01' })
						]
					: g.id === 'amended-by'
						? [inst('stb_2026_94', { date: '2026-03-01' })]
						: g.id === 'related'
							? [
									inst('bwbr0001'),
									{ ...inst('a'), ref: { collection: 'articles', key: 'bwbr0001_1' } }
								]
							: [],
			total: g.id === 'international' ? 71 : g.id === 'amended-by' ? 1 : g.id === 'related' ? 2 : 0
		}));

	it('splits the laws into Wetten, Artikelen, Europees en internationaal and Publicaties', () => {
		const kinds = kindsOf(groups(), 'instruments', new Map());
		expect(kinds.map((k) => [k.label, k.count])).toEqual([
			['Wetten', 1],
			['Artikelen', 1],
			['Europees en internationaal', 71],
			['Publicaties', 1]
		]);
	});

	it('orders the acts of the EU by what the law implements, then the newest, not by CELEX', () => {
		const eu = kindsOf(groups(), 'instruments', new Map()).find((k) => k.id === 'europees');
		expect(eu?.rows.map((r) => r.ref.key)).toEqual(['32022l2555', '32020r0001', '32019l0001']);
	});
});

describe('previewPerSoort', () => {
	it('names a head to come as the soort will be named, one per soort', () => {
		const p = (id: string, kind: string, count: number | null) => ({
			id,
			label: `Groep ${id}`,
			count,
			kind,
			kindLabel: kind === 'documents' ? 'Stukken' : 'Uitspraken',
			section: 'Sectie'
		});
		const out = previewPerSoort([
			p('a', 'documents', 4),
			p('b', 'documents', 6),
			p('c', 'judgments', 9)
		]);
		expect(out.map((o) => [o.label, o.count])).toEqual([
			['Stukken', 10],
			['Uitspraken', 9]
		]);
		expect(out.every((o) => o.section === undefined)).toBe(true);
	});

	it('counts nothing where one of the groups is not counted yet', () => {
		const p = (id: string, count: number | null) => ({ id, label: id, count, kind: 'documents' });
		expect(previewPerSoort([p('a', 4), p('b', null)])[0].count).toBeNull();
	});
});
