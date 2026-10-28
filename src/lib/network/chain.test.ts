import { describe, expect, it } from 'vitest';
import { chain, chainTally } from './chain';

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
	leden: [],
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
	it('stands in layers: the law, its articles, the regulations per kind', () => {
		const k = chain({ id: 'instruments/bwbr0010346', name: 'Arbowet' }, delegated, null);
		expect(k.layers.map((l) => l.id)).toEqual(['law', 'article', 'amvb', 'kb', 'ministerial']);
		expect(k.layers[1].nodes.map((a) => a.short)).toEqual([
			'art. 3',
			'art. 16',
			'art. 20',
			'art. 22',
			'art. 24',
			'art. 33'
		]);
	});

	it('says how a regulation hangs under the law: a power, or only named', () => {
		const k = chain({ id: 'instruments/bwbr0010346', name: 'Arbowet' }, delegated, null);
		const asbest = k.layers.find((l) => l.id === 'amvb')!.nodes[0];
		expect(asbest.grondslag).toBe('art. 16, 20');
		expect(asbest.mentions).toBe('art. 22');
		expect(asbest.parents.find((o) => o.id.endsWith('_22'))?.way).toBe('mentioned');
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
		// The rest listed, for "Alle 2", not drawn and adding no article (R3-K F4).
		expect(uncapped.more.amvb?.map((n) => n.id)).toEqual(['instruments/b']);
		expect(
			uncapped.layers.find((l) => l.id === 'article')!.nodes.map((a) => a.short)
		).not.toContain('art. 33');
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
			{ id: 'instruments/bwbr0010346', way: 'delegates' }
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
		expect(k.layers.find((l) => l.id === 'article')!.nodes.map((a) => a.short)).toEqual([
			'art. 16'
		]);
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

	it('puts a wet that hangs under an article in the one layer Wet, with its articles and regelingen under it', () => {
		const uhw = item('instruments/uhw', 'Uitvoeringswet huurprijzen woonruimte', 'wet', [
			article('248', 'mentioned')
		]);
		uhw.sub_delegated = [
			{
				instrument: law('instruments/reg', 'Besluit huurprijzen'),
				kind: 'amvb',
				date_in_force: '2006-03-01',
				expired_on: null,
				basis_kind: 'delegates',
				articles: [{ ...article('10'), id: 'articles/uhw_10', key: 'uhw_10' }]
			}
		] as never;
		const k = chain(
			{ id: 'instruments/bwbr0010346', name: 'Burgerlijk Wetboek Boek 7' },
			{ bwb_id: 'BWBR0010346', total: 1, items: [uhw] } as never,
			null
		);
		expect(k.layers.map((l) => l.id)).toEqual(['law', 'article', 'amvb']);
		expect(k.layers.filter((l) => l.label === 'Wet')).toHaveLength(1);
		expect(k.layers[0].nodes.map((n) => n.id)).toEqual([
			'instruments/bwbr0010346',
			'instruments/uhw'
		]);
		const [bw, ownArt] = k.layers[1].nodes;
		expect(bw.parents).toEqual([
			{ id: 'instruments/bwbr0010346', way: 'delegates' },
			{ id: 'instruments/uhw', way: 'mentioned' }
		]);
		expect(ownArt.parents).toEqual([{ id: 'instruments/uhw', way: 'delegates' }]);
		expect(k.layers[2].nodes[0].parents.map((p) => p.id)).toEqual(['articles/uhw_10']);
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
			const k = { layers: [{ id: '0|Persoon', label: 'Persoon', nodes: [person(roles)] }] };
			return chainTally(k, k).kinds;
		};
		expect(tally({ government_functions: [{ from_date: '2020-01-01', to_date: null }] })).toEqual({
			bewindspersonen: 1
		});
		expect(tally({})).toEqual({ kamerleden: 1 });
	});
});
