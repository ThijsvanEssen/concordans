import { describe, expect, it } from 'vitest';
import { chain, chainTally, isOutside, whyFaint } from './chain';
import { placeLayers } from './chain-place';
import { citeLines, citeOf, citeText } from './cite-label';

const law = (id: string, title: string) => ({
	id,
	key: id.split('/')[1],
	bwb_id: id.split('/')[1].toUpperCase(),
	celex: null,
	title,
	citation_title: title,
	short_title: null,
	abbreviation: null,
	display_name: title,
	signed_on: null,
	official_url: null,
	article_count: null,
	inbound_citation_count: 12,
	judgment_count: null,
	outbound_citation_count: null,
	path: null
});
const article = (n: string, basis: 'delegates' | 'mentioned' = 'delegates') => ({
	leden: [] as string[],
	onderdelen: [],
	aanhef: false,
	id: `articles/bwbr0010346_${n}`,
	key: `bwbr0010346_${n}`,
	article_number: n,
	display_name: `Artikel ${n}`,
	text: n,
	basis_kind: basis,
	referring: []
});
const item = (id: string, title: string, kind: string, articles: ReturnType<typeof article>[]) => ({
	instrument: law(id, title),
	kind,
	date_in_force: '2006-03-01',
	basis_kind: 'delegates' as const,
	articles,
	also_based_on: [],
	sub_delegated: []
});

const delegated = {
	bwb_id: 'BWBR0010346',
	total: 4,
	items: [
		item('instruments/a', 'Asbestverwijderingsbesluit 2005', 'amvb', [
			article('20'),
			article('16'),
			article('22', 'mentioned')
		]),
		item('instruments/b', 'Productenbesluit asbest', 'amvb', [article('16'), article('33')]),
		item('instruments/c', 'Alcoholregeling', 'ministeriele-regeling', [article('24', 'mentioned')]),
		item('instruments/d', 'Besluit X', 'kb', [article('3')])
	]
} as never;

describe('the keten of a law', () => {
	it('stands in layers of one kind each: the law, the regulations per kind, no layer of articles', () => {
		const k = chain({ id: 'instruments/bwbr0010346', name: 'Arbowet' }, delegated, null);
		expect(k.layers.map((l) => l.id)).toEqual(['law', 'amvb', 'kb', 'ministerial']);
	});

	it('says how a regulation hangs under the law: a power, or only named', () => {
		const k = chain({ id: 'instruments/bwbr0010346', name: 'Arbowet' }, delegated, null);
		const asbest = k.layers.find((l) => l.id === 'amvb')!.nodes[0];
		expect(asbest.grondslag).toBe('art. 16, 20 Arbowet');
		expect(asbest.mentions).toBe('art. 22 Arbowet');
		expect(asbest.parents.map((o) => [o.id, o.way, o.cite?.full])).toEqual([
			['instruments/bwbr0010346', 'delegates', 'art. 16, 20 Arbowet'],
			['instruments/bwbr0010346', 'mentioned', 'art. 22 Arbowet']
		]);
	});

	it('draws up to a number a layer and counts the rest, the one marked always', () => {
		const k = chain({ id: 'w', name: 'Arbowet' }, delegated, null, {
			max: 1,
			keep: 'instruments/b'
		});
		expect(k.layers.find((l) => l.id === 'amvb')!.nodes.map((n) => n.id)).toEqual([
			'instruments/a',
			'instruments/b'
		]);
		const uncapped = chain({ id: 'w', name: 'Arbowet' }, delegated, null, { max: 1 });
		expect(uncapped.rest.amvb).toBe(1);
		// The rest listed, for "Alle 2", not drawn (R3-K F4).
		expect(uncapped.more.amvb?.map((n) => n.id)).toEqual(['instruments/b']);
	});

	it('puts the laws a regulation is issued under above it', () => {
		const basis = {
			bwb_id: 'BWBR0019316',
			total: 1,
			items: [
				{
					instrument: law('instruments/bwbr0010346', 'Arbowet'),
					kind: 'wet',
					basis_kind: 'delegates',
					articles: [article('16')]
				}
			]
		} as never;
		const k = chain({ id: 'instruments/bwbr0019316', name: 'Asbest' }, null, basis);
		expect(k.layers.map((l) => l.id)).toEqual(['basis', 'law']);
		expect(k.layers[1].nodes[0].parents).toEqual([
			{
				id: 'instruments/bwbr0010346',
				way: 'delegates',
				cite: expect.objectContaining({ full: 'art. 16 Arbowet' })
			}
		]);
		expect(k.total).toBe(0);
	});

	it('leaves decrees that only change out of the layers, and names a regulation they change that the data lacks', () => {
		const metWijziging = {
			bwb_id: 'BWBR0010346',
			total: 3,
			items: [
				item('instruments/a', 'Asbestverwijderingsbesluit 2005', 'amvb', [article('16')]),
				item(
					'instruments/w',
					'Wijzigingsbesluit Arbeidsomstandighedenbesluit (nieuwe opzet)',
					'amvb',
					[article('16')]
				),
				item('instruments/x', 'Aanpassingsbesluit vierde tranche Awb', 'amvb', [article('3')])
			]
		} as never;
		const k = chain({ id: 'w', name: 'Arbeidsomstandighedenwet' }, metWijziging, null);
		expect(k.layers.find((l) => l.id === 'amvb')!.nodes.map((n) => n.id)).toEqual([
			'instruments/a'
		]);
		expect(k.amending).toHaveLength(2);
		expect(k.missing).toEqual(['Arbeidsomstandighedenbesluit']);
	});

	it('heads the start by its kind: an AMvB is no Wet (R3-K F2)', () => {
		const k = chain({ id: 'instruments/bwbr0022762', name: 'Activiteitenbesluit' }, null, null, {
			kind: 'AMvB'
		});
		expect(k.layers[0].label).toBe('AMvB');
		const publication = chain(
			{ id: 'instruments/stb_2018_101', name: 'Stb. 2018, 101' },
			null,
			null,
			{
				kind: 'publicatie'
			}
		);
		expect(publication.layers[0].label).toBe('Publicatie');
	});

	it('draws from an article only the regulations issued under it (R3-K F5)', () => {
		const k = chain({ id: 'instruments/bwbr0010346', name: 'Arbowet' }, delegated, null, {
			article: '16'
		});
		expect(k.layers.find((l) => l.id === 'amvb')!.nodes.map((n) => n.id)).toEqual([
			'instruments/a',
			'instruments/b'
		]);
		expect(k.layers.find((l) => l.id === 'amvb')!.nodes[0].parents[0].cite?.full).toBe(
			'art. 16 Arbowet'
		);
		expect(k.total).toBe(2);
	});

	it('puts the EU act above the law that implements it, and its implementing laws below (R3-K F1)', () => {
		const directive = {
			id: 'instruments/32015l2302',
			key: '32015l2302',
			bwb_id: null,
			celex: '32015L2302',
			title: 'Richtlijn',
			citation_title: 'Richtlijn (EU) 2015/2302',
			kind: 'richtlijn'
		};
		const act = { ...directive, id: 'instruments/bwbr0040511', celex: null, kind: 'wet' };
		const upward = chain({ id: 'instruments/bwbr0040511', name: 'Implementatiewet' }, null, null, {
			eu: { implements: [directive], implementedBy: [] }
		});
		expect(upward.layers.map((l) => [l.id, l.label])).toEqual([
			['eu', 'Richtlijn'],
			['law', 'Wet']
		]);
		expect(upward.layers[1].nodes[0].parents).toEqual([{ id: directive.id, way: 'delegates' }]);
		const downward = chain({ id: directive.id, name: 'Richtlijn (EU) 2015/2302' }, null, null, {
			kind: 'richtlijn',
			eu: { implements: [], implementedBy: [act] }
		});
		expect(downward.layers.map((l) => [l.id, l.label])).toEqual([
			['law', 'Richtlijn'],
			['implementation', 'Implementatie']
		]);
	});

	it('hangs a regeling under the AMvB, its line labelled with the articles and the abbreviation of each law', () => {
		const cbb = item('instruments/cbb', 'Cyberbeveiligingsbesluit', 'amvb', [article('3')]);
		(cbb.instrument as { abbreviation: string | null }).abbreviation = 'Cbb';
		cbb.sub_delegated = [
			{
				instrument: law('instruments/reg', 'Regeling cyberbeveiliging EZK'),
				kind: 'ministeriele-regeling',
				date_in_force: '2025-01-01',
				expired_on: null,
				basis_kind: 'delegates',
				articles: [article('19'), article('28')]
			}
		] as never;
		const direct = item('instruments/aanw', 'Besluit aanwijzing', 'ministeriele-regeling', [
			article('68')
		]);
		const k = chain(
			{ id: 'instruments/bwbr0010346', name: 'Cyberbeveiligingswet', abbreviation: 'Cbw' },
			{ bwb_id: 'BWBR0010346', total: 2, items: [cbb, direct] } as never,
			null
		);
		// A regeling stands in the layer of its kind, whatever it rests on.
		expect(k.layers.map((l) => l.id)).toEqual(['law', 'amvb', 'ministerial']);
		const ministerial = k.layers[2].nodes;
		const ezk = ministerial.find((n) => n.id === 'instruments/reg')!;
		expect(ezk.parents.map((p) => [p.id, p.cite?.full])).toEqual([
			['instruments/cbb', 'art. 19, 28 Cbb']
		]);
		expect(ezk.grondslag).toBe('art. 19, 28 Cbb');
		// A regeling on the law itself: its line runs past the AMvB layer, labelled with its article.
		const aanw = ministerial.find((n) => n.id === 'instruments/aanw')!;
		expect(aanw.parents.map((p) => [p.id, p.cite?.full])).toEqual([
			['instruments/bwbr0010346', 'art. 68 Cbw']
		]);
	});

	it('draws a wet beside the law in the layer Wet, the regelingen under it hanging from it', () => {
		const uhw = item('instruments/uhw', 'Uitvoeringswet huurprijzen woonruimte', 'wet', [
			article('248')
		]);
		uhw.sub_delegated = [
			{
				instrument: law('instruments/reg', 'Besluit huurprijzen'),
				kind: 'amvb',
				date_in_force: '2006-03-01',
				expired_on: null,
				basis_kind: 'delegates',
				articles: [article('10')]
			}
		] as never;
		const k = chain(
			{ id: 'instruments/bwbr0010346', name: 'Burgerlijk Wetboek Boek 7' },
			{ bwb_id: 'BWBR0010346', total: 1, items: [uhw] } as never,
			null
		);
		expect(k.layers.map((l) => l.id)).toEqual(['law', 'amvb']);
		expect(k.layers.filter((l) => l.label === 'Wet')).toHaveLength(1);
		expect(k.layers[0].nodes.map((n) => n.id)).toEqual([
			'instruments/bwbr0010346',
			'instruments/uhw'
		]);
		expect(k.layers[1].nodes[0].parents.map((p) => p.id)).toEqual(['instruments/uhw']);
	});
});

describe('the keten of a law and of its AMvB', () => {
	it('gives both the same kinds of layer: a row per kind of document', () => {
		const cbw = chain(
			{ id: 'instruments/cbw', name: 'Cyberbeveiligingswet', abbreviation: 'Cbw' },
			{
				bwb_id: 'CBW',
				total: 1,
				items: [item('instruments/cbb', 'Cyberbeveiligingsbesluit', 'amvb', [article('3')])]
			} as never,
			null
		);
		const cbb = chain({ id: 'instruments/cbb', name: 'Cyberbeveiligingsbesluit' }, null, {
			bwb_id: 'CBB',
			total: 1,
			items: [
				{
					instrument: law('instruments/cbw', 'Cyberbeveiligingswet'),
					kind: 'wet',
					basis_kind: 'delegates',
					articles: [article('3')]
				}
			]
		} as never);
		const rows = new Set(['basis', 'law', 'amvb', 'kb', 'ministerial', 'policy', 'other']);
		for (const k of [cbw, cbb])
			for (const l of k.layers) expect(rows.has(l.id as string)).toBe(true);
	});

	it('says the first articles, +N and the law on a line past 27 characters, all of them on the card', () => {
		const many = [article('3'), article('16'), article('17'), article('21'), article('24')];
		const k = chain(
			{ id: 'instruments/bwbr0010346', name: 'Cyberbeveiligingswet', abbreviation: 'Cbw' },
			{
				bwb_id: 'B',
				total: 1,
				items: [item('instruments/cbb', 'Cyberbeveiligingsbesluit', 'amvb', many)]
			} as never,
			null
		);
		const cite = k.layers[1].nodes[0].parents[0].cite!;
		expect(cite.full).toBe('art. 3, 16, 17, 21, 24 Cbw');
		expect(citeText(cite)).toBe('art. 3, 16, 17, 21, 24 Cbw');
		const longer = [...many, article('35'), article('44')];
		const k2 = chain(
			{ id: 'instruments/bwbr0010346', name: 'Cyberbeveiligingswet', abbreviation: 'Cbw' },
			{
				bwb_id: 'B',
				total: 1,
				items: [item('instruments/cbb', 'Cyberbeveiligingsbesluit', 'amvb', longer)]
			} as never,
			null
		);
		// never a count alone ("4 art." read as article 4): the first that fit, and how many more
		expect(citeText(k2.layers[1].nodes[0].parents[0].cite!)).toBe('art. 3, 16, 17, 21 +3 Cbw');
	});
	it('cuts a law without an abbreviation to the room the line leaves (B48, BW 7)', () => {
		const besluit = 'Besluit loonbegrip vergoeding aanzegtermijn en transitievergoeding';
		const one = citeOf([article('1')], besluit)!;
		expect(citeText(one)).toBe('art. 1 Besluit loonbegrip…');
		expect(citeText(citeOf([{ ...article('2'), leden: ['4'] }], besluit)!)).toBe(
			'art. 2 lid 4 Besluit loonb…'
		);
		expect(citeLines(one)).toEqual([`art. 1 ${besluit}`]);
	});
	it('keeps a label within 27 characters, the law behind it, where one article is long', () => {
		const long = { ...article('669'), leden: ['1', '3', '5', '7'] };
		const text = citeText(citeOf([long, article('670')], 'BW')!);
		expect(text).toMatch(/^art\. 669 lid 1.*… \+1 BW$/);
		expect(text.length).toBeLessThanOrEqual(27);
		expect(citeText(citeOf([article('3')], 'BW')!)).toBe('art. 3 BW');
	});
	it('draws two lines to a regulation under the law and under its AMvB: one of each', () => {
		const zorg = item(
			'instruments/zorg',
			'Cyberbeveiligingsregeling voor de zorg',
			'ministeriele-regeling',
			[article('68')]
		);
		const cbb = {
			...item('instruments/cbb', 'Cyberbeveiligingsbesluit', 'amvb', [article('3')]),
			instrument: { ...law('instruments/cbb', 'Cyberbeveiligingsbesluit'), abbreviation: 'Cbb' },
			sub_delegated: [
				{
					instrument: zorg.instrument,
					kind: zorg.kind,
					date_in_force: zorg.date_in_force,
					basis_kind: 'mentioned',
					articles: [article('20', 'mentioned'), article('29', 'mentioned')]
				}
			]
		};
		const k = chain(
			{ id: 'instruments/bwbr0010346', name: 'Cyberbeveiligingswet', abbreviation: 'Cbw' },
			{ bwb_id: 'B', total: 2, items: [cbb, zorg] } as never,
			null
		);
		const node = k.layers.flatMap((l) => l.nodes).find((n) => n.id === 'instruments/zorg')!;
		expect(node.parents.map((p) => [p.id, p.way, p.cite && citeText(p.cite)])).toEqual([
			['instruments/bwbr0010346', 'delegates', 'art. 68 Cbw'],
			['instruments/cbb', 'mentioned', 'art. 20, 29 Cbb']
		]);
	});
	it('shortens a label of leden to the articles that fit, the glance naming them all', () => {
		const ienw = [
			{ ...article('2'), leden: ['2'] },
			{ ...article('3'), leden: ['3'] },
			article('19'),
			{ ...article('23'), leden: ['1'] }
		];
		const k = chain(
			{ id: 'instruments/bwbr0052875', name: 'Cyberbeveiligingsbesluit', abbreviation: 'Cbb' },
			{
				bwb_id: 'B',
				total: 1,
				items: [
					item('instruments/ienw', 'Cyberbeveiligingsregeling IenW', 'ministeriele-regeling', ienw)
				]
			} as never,
			null
		);
		const cite = k.layers[1].nodes[0].parents[0].cite!;
		expect(citeText(cite)).toBe('art. 2 lid 2 +3 Cbb');
		expect(citeLines(cite)).toEqual([
			'art. 2 lid 2 Cbb',
			'art. 3 lid 3 Cbb',
			'art. 19 Cbb',
			'art. 23 lid 1 Cbb'
		]);
	});
});

describe('what Soort and Relatie count in a keten', () => {
	it('counts the bronnen listed under Alle N with those drawn, so Tonen and the layer say one number', () => {
		const k = chain(
			{ id: 'instruments/bwbr0010346', name: 'Burgerlijk Wetboek Boek 7' },
			delegated,
			null,
			{ max: 1 }
		);
		const listed = Object.values(k.more).flat().length;
		expect(listed).toBeGreaterThan(0);
		const drawn = k.layers.flatMap((l) => l.nodes).filter((n) => n.collection === 'instruments');
		expect(chainTally(k, k).kinds.wetten).toBe(drawn.length + listed);
	});
	it('counts each line as the kind it is drawn in', () => {
		const k = chain({ id: 'instruments/bwbr0010346', name: 'BW 7' }, delegated, null);
		const { lines } = chainTally(k, k);
		expect(lines.structural).toBeGreaterThan(0);
		expect(lines.citation).toBeGreaterThan(0);
	});
	it('counts a person by the posts they hold: a bewindspersoon is no Kamerlid', () => {
		const person = (roles: Record<string, unknown>) => ({
			id: 'members/x',
			name: 'X',
			short: 'X',
			collection: 'members' as const,
			kind: null,
			since: null,
			grondslag: null,
			mentions: null,
			parents: [],
			further: [],
			roles
		});
		const tally = (roles: Record<string, unknown>) => {
			const k = {
				layers: [{ id: '0|Persoon' as const, label: 'Persoon', nodes: [person(roles)] }]
			};
			return chainTally(k, k).kinds;
		};
		expect(tally({ government_functions: [{ from_date: '2020-01-01', to_date: null }] })).toEqual({
			bewindspersonen: 1
		});
		expect(tally({})).toEqual({ kamerleden: 1 });
	});
});

describe('the keten of the Grondwet: what only names the law, and what the data does not know', () => {
	const gw = { id: 'instruments/bwbr0001840', name: 'Grondwet', abbreviation: 'Gw' };
	const sub = (id: string, title: string, kind: string, basis: 'delegates' | 'mentioned') => ({
		instrument: law(id, title),
		kind,
		date_in_force: '2006-03-01',
		expired_on: null,
		basis_kind: basis,
		articles: [article('1', basis)]
	});
	const amar = item('instruments/amar', 'AMAR', 'ministeriele-regeling', [
		article('68', 'mentioned')
	]);
	amar.basis_kind = 'mentioned' as never;
	amar.sub_delegated = [
		sub('instruments/defensie', 'Defensieregeling', 'ministeriele-regeling', 'delegates'),
		sub('instruments/gedeeld', 'Gedeelde regeling', 'ministeriele-regeling', 'delegates')
	] as never;
	const kb = item('instruments/kb', 'Besluit departementale herindeling', 'kb', [article('44')]);
	kb.sub_delegated = [
		sub('instruments/gedeeld', 'Gedeelde regeling', 'ministeriele-regeling', 'delegates')
	] as never;
	const delegated = { bwb_id: 'BWBR0001840', total: 2, items: [amar, kb] } as never;
	const ids = (k: ReturnType<typeof chain>) => k.layers.flatMap((l) => l.nodes.map((n) => n.id));

	it('leaves out what hangs only under a regulation that only names the law', () => {
		const k = chain(gw, delegated, null, { mentions: false });
		expect(ids(k)).toContain('instruments/kb');
		expect(ids(k)).not.toContain('instruments/amar');
		expect(ids(k)).not.toContain('instruments/defensie');
		// A power given by a regulation that stays leads to it all the same.
		expect(ids(k)).toContain('instruments/gedeeld');
		expect(k.total).toBe(2);
		const gedeeld = k.layers.flatMap((l) => l.nodes).find((n) => n.id === 'instruments/gedeeld')!;
		expect(gedeeld.parents.map((p) => p.id)).toEqual(['instruments/kb']);
	});

	it('draws all of them, with the mention as a dashed line, under Noemt', () => {
		const k = chain(gw, delegated, null, { mentions: true });
		expect(ids(k)).toEqual(expect.arrayContaining(['instruments/amar', 'instruments/defensie']));
		const amarNode = k.layers.flatMap((l) => l.nodes).find((n) => n.id === 'instruments/amar')!;
		expect(amarNode.parents.map((p) => p.way)).toEqual(['mentioned']);
	});

	it('takes a missing basis_kind for neither a power given nor a mention', () => {
		const procl = item('instruments/procl', 'Proclamatie', 'rijkswet', [article('218')]);
		procl.basis_kind = null as never;
		procl.articles[0].basis_kind = null as never;
		const off = chain(gw, { bwb_id: 'x', total: 1, items: [procl] } as never, null, {
			mentions: false
		});
		expect(ids(off)).toEqual(['instruments/bwbr0001840']);
		const on = chain(gw, { bwb_id: 'x', total: 1, items: [procl] } as never, null, {
			mentions: true
		});
		const n = on.layers.flatMap((l) => l.nodes).find((x) => x.id === 'instruments/procl')!;
		expect(n.parents.map((p) => p.way)).toEqual(['unknown']);
		expect(n.grondslag).toBeNull();
		expect(n.mentions).toBeNull();
		expect(n.unknown).toBe('art. 218 Gw');
		// beside the law in its layer, with its dashed line: no layer of its own
		expect(on.layers.find((l) => l.id === 'law')?.nodes.map((x) => x.id)).toEqual([
			'instruments/bwbr0001840',
			'instruments/procl'
		]);
	});

	const refers = [
		{
			id: 'instruments/bwbr0004627',
			key: 'bwbr0004627',
			bwb_id: 'BWBR0004627',
			celex: null,
			display_name: 'Kieswet',
			citation_title: 'Kieswet',
			kind: 'wet',
			date_in_force: '1989-09-01',
			inbound_cited_count: 2,
			inbound_cited_articles: [
				{ key: 'bwbr0001840_56', article_number: '56' },
				{ key: 'bwbr0001840_57', article_number: '57' }
			]
		},
		{
			id: 'instruments/bwbr0005730',
			key: 'bwbr0005730',
			bwb_id: 'BWBR0005730',
			celex: null,
			display_name: 'Aanwijzingen voor de regelgeving',
			citation_title: 'Aanwijzingen voor de regelgeving',
			kind: 'ministeriele-regeling',
			date_in_force: '1993-01-01',
			inbound_cited_count: 25,
			inbound_cited_articles: []
		}
	] as never;

	it('draws a wet that only names the law in its text in Noemt, under the rest, with its articles (B48)', () => {
		const k = chain(gw, delegated, null, { mentions: true, refers });
		const named = k.layers[k.layers.length - 1];
		expect(named).toMatchObject({ id: 'named', label: 'Noemt' });
		expect(k.layers.find((l) => l.id === 'law')!.nodes.map((n) => n.name)).toEqual([gw.name]);
		expect(named.nodes.map((n) => n.name)).toEqual(['Kieswet']);
		// the articles of the law it names, never a count alone ("2 art." reads as article 2)
		expect(named.nodes[0].parents).toMatchObject([
			{ id: 'instruments/bwbr0001840', way: 'mentioned', relation: 'REFERS_TO', named: 2 }
		]);
		expect(named.nodes[0].parents[0].cite?.full).toBe('art. 56, 57 Gw');
		expect(named.nodes[0].mentions).toBe('art. 56, 57 Gw');
	});

	it('puts a wet that names an AMvB in Noemt, and not the law it rests on', () => {
		const cbb = {
			id: 'instruments/bwbr0052875',
			name: 'Cyberbeveiligingsbesluit',
			abbreviation: 'Cbb'
		};
		const cbw = law('instruments/bwbr0052872', 'Cyberbeveiligingswet');
		const basis = {
			bwb_id: 'BWBR0052875',
			total: 1,
			items: [{ instrument: cbw, kind: 'wet', basis_kind: 'delegates', articles: [article('3')] }]
		} as never;
		const naming = [
			{
				...(refers as never as Record<string, unknown>[])[0],
				id: cbw.id,
				display_name: 'Cyberbeveiligingswet',
				citation_title: 'Cyberbeveiligingswet'
			},
			{
				...(refers as never as Record<string, unknown>[])[0],
				id: 'instruments/hrw',
				display_name: 'Handelsregisterwet 2007',
				citation_title: 'Handelsregisterwet 2007'
			}
		] as never;
		const k = chain(cbb, null, basis, { kind: 'amvb', mentions: true, refers: naming });
		const ids = (id: string) => k.layers.find((l) => l.id === id)?.nodes.map((n) => n.id);
		expect(ids('basis')).toEqual([cbw.id]);
		expect(ids('law')).toEqual([cbb.id]);
		expect(ids('named')).toEqual(['instruments/hrw']);
		expect(k.layers.flatMap((l) => l.nodes).filter((n) => n.id === cbw.id)).toHaveLength(1);
	});

	it('puts a wet that names a regulation in Noemt, not above the AMvB it rests on (B71)', () => {
		const regeling = {
			id: 'instruments/bwbr0052878',
			name: 'Cyberbeveiligingsregeling IenW'
		};
		const cbb = law('instruments/bwbr0052875', 'Cyberbeveiligingsbesluit');
		const basis = {
			bwb_id: 'BWBR0052878',
			total: 1,
			items: [{ instrument: cbb, kind: 'amvb', basis_kind: 'delegates', articles: [article('3')] }]
		} as never;
		const naming = [
			{
				...(refers as never as Record<string, unknown>[])[0],
				id: 'instruments/bwbr0052872',
				display_name: 'Cyberbeveiligingswet',
				citation_title: 'Cyberbeveiligingswet'
			},
			{ ...(refers as never as Record<string, unknown>[])[1], id: cbb.id }
		] as never;
		const k = chain(regeling, null, basis, {
			kind: 'ministeriele-regeling',
			mentions: true,
			refers: naming
		});
		expect(k.layers.map((l) => [l.id, l.nodes.map((n) => n.name)])).toEqual([
			['basis', ['Cyberbeveiligingsbesluit']],
			['law', ['Cyberbeveiligingsregeling IenW']],
			['named', ['Cyberbeveiligingswet']]
		]);
	});

	it('puts those that name most of its articles first', () => {
		const advocaten = {
			...(refers as never as Record<string, unknown>[])[0],
			id: 'instruments/adv',
			citation_title: 'Advocatenwet',
			display_name: 'Advocatenwet',
			inbound_cited_count: 1
		};
		const k = chain(gw, delegated, null, {
			mentions: true,
			refers: [advocaten, ...(refers as never as [])] as never
		});
		expect(k.layers.find((l) => l.id === 'named')!.nodes.map((n) => n.name)).toEqual([
			'Kieswet',
			'Advocatenwet'
		]);
	});

	// B109: `related-instruments` comes late; what stood before it stands after it.
	describe('when the wetten that name it come late', () => {
		const wet = (id: string, name: string, way: string, subs: unknown[] = []) => ({
			...item(id, name, 'wet', [article('5')]),
			basis_kind: way,
			articles: [{ ...article('5'), basis_kind: way }],
			sub_delegated: subs
		});
		const carrying = wet('instruments/uavg', 'Uitvoeringswet AVG', 'mentioned', [
			{
				...item('instruments/besluit', 'Besluit AVG', 'AMvB', [article('2')]),
				basis_kind: 'delegates'
			}
		]);
		const lone = wet('instruments/verzamelwet', 'Verzamelwet', 'mentioned');
		const given = wet('instruments/organiek', 'Organieke wet', 'delegates');
		const first = {
			bwb_id: 'BWBR0001840',
			total: 3,
			items: [carrying, lone, given]
		} as never;
		const rows = (k: ReturnType<typeof chain>) =>
			k.layers.map((l) => [l.id, l.nodes.map((n) => n.name)]);

		it('leaves in Wet what rests on the law, and a wet regulations hang from', () => {
			const k = chain(gw, first, null, { mentions: true });
			expect(rows(k)).toEqual([
				['law', [gw.name, 'Organieke wet', 'Uitvoeringswet AVG']],
				['amvb', ['Besluit AVG']],
				['named', ['Verzamelwet']]
			]);
		});

		it('changes nothing above Noemt, and keeps what it held first in front', () => {
			const before = chain(gw, first, null, { mentions: true });
			const after = chain(gw, first, null, { mentions: true, refers });
			expect(rows(after).slice(0, -1)).toEqual(rows(before).slice(0, -1));
			expect(rows(after).at(-1)).toEqual(['named', ['Verzamelwet', 'Kieswet']]);
			expect(after.total).toBe(before.total);
		});

		it('has no Noemt without a wet that names it, nor with Noemt off', () => {
			const none = chain(gw, delegated, null, { mentions: true, refers: [] });
			expect(none.layers.some((l) => l.id === 'named')).toBe(false);
			const off = chain(gw, first, null, { mentions: false, refers });
			expect(off.layers.some((l) => l.id === 'named')).toBe(false);
		});

		it('lists those not drawn under Noemt itself', () => {
			const many = ['A', 'B', 'C'].map((name, i) => ({
				...(refers as never as Record<string, unknown>[])[0],
				id: `instruments/${name}`,
				citation_title: name,
				display_name: name,
				inbound_cited_count: 3 - i
			}));
			const k = chain(gw, null, null, { mentions: true, refers: many as never, max: 2 });
			expect(k.rest).toEqual({ named: 1 });
			expect(k.more.named?.map((n) => n.name)).toEqual(['C']);
		});

		it('places Noemt out from under its law, and what comes late beyond what stands', () => {
			const at = (k: ReturnType<typeof chain>) =>
				placeLayers(k.layers, {
					rest: k.rest,
					tops: k.layers.map((_, i) => 64 + i * 104),
					left: 120,
					width: 1200,
					drop: 58,
					slot: 192,
					halfOf: () => 60
				});
			const before = at(chain(gw, first, null, { mentions: true }));
			const after = at(chain(gw, first, null, { mentions: true, refers }));
			for (const [id, p] of before) expect(after.get(id)).toEqual(p);
			expect(after.get('instruments/bwbr0004627')!.x).toBe(
				before.get('instruments/verzamelwet')!.x + 192
			);
		});
	});

	it('leaves them out while Noemt is off', () => {
		const k = chain(gw, delegated, null, { mentions: false, refers });
		expect(k.layers.find((l) => l.id === 'law')!.nodes.map((n) => n.name)).toEqual([gw.name]);
	});
});

// A bron drawn faint says why in its glance (B53): vervallen, or dated outside the period.
describe('why a bron of the keten is drawn otherwise', () => {
	const period = { van: '2020-01-01', tot: '2024-12-31' };
	it('says since when a regulation is no longer in force', () => {
		expect(whyFaint({ since: '2010-01-01', expired: '2019-07-01' }, null)).toEqual([
			'Vervallen sinds 1 juli 2019'
		]);
	});
	it('says a bron dated outside the period is so, with its date', () => {
		expect(whyFaint({ since: '2026-01-01', expired: null }, period)).toEqual([
			'Buiten de periode, in werking sinds 1 januari 2026'
		]);
		expect(isOutside({ since: '2019-12-31' }, period)).toBe(true);
	});
	it('says nothing of a bron in force within the period, or without a date or a period', () => {
		expect(whyFaint({ since: '2022-05-01', expired: null }, period)).toEqual([]);
		expect(whyFaint({ since: null, expired: null }, period)).toEqual([]);
		expect(whyFaint({ since: '2026-01-01' }, null)).toEqual([]);
		expect(whyFaint({ since: '2026-01-01' }, { van: null, tot: null })).toEqual([]);
	});
	it('says both where both hold', () => {
		expect(whyFaint({ since: '2010-01-01', expired: '2019-07-01' }, period)).toHaveLength(2);
	});
});

describe('the lines of the keten (B86)', () => {
	const gw = { id: 'instruments/gw', name: 'Grondwet', abbreviation: 'Gw' };
	const under = (parent: ReturnType<typeof item>, ...subs: ReturnType<typeof item>[]) => {
		parent.sub_delegated = subs as never;
		return parent;
	};
	const parentsOf = (k: ReturnType<typeof chain>, id: string) =>
		k.layers
			.flatMap((l) => l.nodes)
			.find((n) => n.id === id)!
			.parents.map((p) => [p.id, p.way, p.cite?.full]);
	const idsIn = (k: ReturnType<typeof chain>, layer: string) =>
		k.layers.find((l) => l.id === layer)?.nodes.map((n) => n.id);

	it('keeps the line of a wet on a grondslag, with its article; a wet with both has both', () => {
		const k = chain(
			gw,
			{
				bwb_id: 'x',
				total: 2,
				items: [
					item('instruments/grond', 'Aanvullingswet', 'wet', [
						article('14'),
						article('21', 'mentioned')
					]),
					item('instruments/uhw', 'Bekendmakingswet', 'wet', [article('88')])
				]
			} as never,
			null
		);
		expect(idsIn(k, 'law')).toEqual(['instruments/gw', 'instruments/grond', 'instruments/uhw']);
		expect(parentsOf(k, 'instruments/grond')).toEqual([
			['instruments/gw', 'delegates', 'art. 14 Gw'],
			['instruments/gw', 'mentioned', 'art. 21 Gw']
		]);
		expect(parentsOf(k, 'instruments/uhw')).toEqual([
			['instruments/gw', 'delegates', 'art. 88 Gw']
		]);
	});

	// As the Grondwet: enough AMvB's directly under the law to fill the row on their own.
	const direct = ['a', 'b', 'c'].map((x) =>
		item(`instruments/${x}`, `Besluit ${x}`, 'amvb', [article('89')])
	);
	const awb = under(
		item('instruments/awb', 'Algemene wet bestuursrecht', 'wet', [article('107')]),
		item('instruments/z', 'Zuiver besluit', 'amvb', [article('8')])
	);
	const delegatedGw = { bwb_id: 'x', total: 4, items: [...direct, awb] } as never;

	it('does not fill a row with what hangs under the law: a wet beside it keeps its regulation', () => {
		const k = chain(gw, delegatedGw, null, { max: 2 });
		expect(idsIn(k, 'amvb')).toEqual(['instruments/a', 'instruments/z']);
		expect(parentsOf(k, 'instruments/z').map(([id]) => id)).toEqual(['instruments/awb']);
		expect(k.rest.amvb).toBe(2);
	});

	it('draws what hangs under the bron marked first', () => {
		const marked = under(item('instruments/w', 'Wet', 'wet', [article('1')]), ...direct.slice(1));
		const k = chain(gw, { bwb_id: 'x', total: 2, items: [direct[0], marked] } as never, null, {
			max: 1,
			keep: 'instruments/w'
		});
		expect(idsIn(k, 'amvb')).toEqual(['instruments/b']);
	});

	it('keeps a parent that is not drawn among the parents, listed under the others', () => {
		const wetten = ['p', 'q'].map((x) =>
			under(
				item(`instruments/${x}`, `Wet ${x}`, 'wet', [article('1')]),
				item(`instruments/${x}-r`, `Regel ${x}`, 'beleidsregel', [article('2')])
			)
		);
		const k = chain(gw, { bwb_id: 'x', total: 2, items: wetten } as never, null, { max: 1 });
		expect(idsIn(k, 'law')).toEqual(['instruments/gw', 'instruments/p']);
		expect(k.more.law?.map((n) => n.id)).toEqual(['instruments/q']);
		// A row with room draws it all the same; the drawing says where it hangs (a stump).
		const q = k.layers
			.find((l) => l.id === 'policy')!
			.nodes.concat(k.more.policy ?? [])
			.find((n) => n.id === 'instruments/q-r')!;
		expect(q.parents.map((p) => p.id)).toEqual(['instruments/q']);
	});
});
