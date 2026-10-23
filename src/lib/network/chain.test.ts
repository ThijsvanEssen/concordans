import { describe, expect, it } from 'vitest';
import { chain } from './chain';

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
		expect(k.layers.map((l) => l.id)).toEqual(['law', 'article', 'amvb', 'ministerial', 'other']);
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
		const k = chain({ id: 'w', name: 'Arbowet' }, delegated, null, 1, 'instruments/b');
		expect(k.layers.find((l) => l.id === 'amvb')!.nodes.map((n) => n.id)).toEqual([
			'instruments/a',
			'instruments/b'
		]);
		const zonder = chain({ id: 'w', name: 'Arbowet' }, delegated, null, 1);
		expect(zonder.rest.amvb).toBe(1);
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
});
