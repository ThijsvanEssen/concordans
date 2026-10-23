import { describe, expect, it } from 'vitest';
import { capitalize } from '$lib/text/words';
import { relationWords } from '$lib/verbonden/relation-words';
import type { Relation } from '$lib/vocabulary';
import { normalizeItem, type FeedItem } from './feed';
import {
	inwerkingVerbanden,
	publicatieVerbanden,
	relatieVerbanden,
	stukNaam,
	viaRegel,
	viaTekst,
	type Verband
} from './verband';

const zin = (v: Verband) =>
	`${v.label ? `${v.label} ` : ''}${v.delen.map((d) => d.tekst).join('')}`;

const item = (extra: Record<string, unknown>): FeedItem =>
	normalizeItem({
		kind: 'Brief regering',
		date: '2026-10-07',
		node: { collection: 'documents', key: 'k' },
		headline: {},
		...extra
	} as never);

describe('a publication', () => {
	it('names the law it enacts, then the laws it changes with their articles (Stb. 2026, 187)', () => {
		const v = publicatieVerbanden({
			citation: null,
			series: 'stb',
			year: 2026,
			number: '187',
			instruments: [
				{
					official_url: null,
					key: 'bwbr0052872',
					title: 'Cyberbeveiligingswet',
					effect: 'establishes',
					article_count: 111
				},
				{
					official_url: null,
					key: 'bwbr0009950',
					title: 'Telecommunicatiewet',
					effect: 'amends',
					article_count: 5
				},
				{
					official_url: null,
					key: 'bwbr0041548',
					title: 'Wet bekostiging financieel toezicht 2019',
					effect: 'amends',
					article_count: 1
				}
			]
		});
		expect(v.map(zin)).toEqual([
			'Stelt vast Cyberbeveiligingswet',
			'Wijzigt Telecommunicatiewet (5 artikelen) en Wet bekostiging financieel toezicht 2019 (1 artikel)'
		]);
		expect(v[0].delen[0].ref).toBe('instruments/bwbr0052872');
	});
});

describe('an inwerkingtreding', () => {
	it('says what changed, by which publication, and under which law', () => {
		const v = inwerkingVerbanden({
			instrument: {
				official_url: null,
				key: 'bwbr0038456',
				title: 'Besluit energieprestatievergoeding huur'
			},
			article_count: 9,
			changed_articles: 1,
			articles: ['2'],
			new: false,
			publication: {
				citation: null,
				key: 'stcrt_2026_17140',
				series: 'stcrt',
				year: 2026,
				number: '17140',
				path: '/stcrt/2026/17140'
			},
			based_on: {
				instrument: {
					official_url: null,
					key: 'bwbr0014315',
					title: 'Uitvoeringswet huurprijzen woonruimte'
				},
				kind: 'amvb',
				articles: ['10', '19bis']
			}
		});
		expect(v.map(zin)).toEqual([
			'Art. 2 gewijzigd bij Stcrt. 2026, 17140',
			'Krachtens Uitvoeringswet huurprijzen woonruimte, art. 10 en 19bis'
		]);
		expect(v[0].delen[2]).toMatchObject({
			ref: 'instruments/stcrt_2026_17140',
			href: '/stcrt/2026/17140'
		});
	});

	it('names a new law by its articles and the publication that enacted it; many by their count', () => {
		const nieuw = inwerkingVerbanden({
			instrument: { official_url: null, key: 'bwbr0052872', title: 'Cyberbeveiligingswet' },
			article_count: 111,
			changed_articles: 111,
			articles: [],
			new: true,
			publication: {
				citation: null,
				key: 'stb_2026_187',
				series: 'stb',
				year: 2026,
				number: '187',
				path: '/stb/2026/187'
			},
			based_on: null
		});
		expect(nieuw.map(zin)).toEqual(['111 artikelen, vastgesteld bij Stb. 2026, 187']);
		const veel = inwerkingVerbanden({
			instrument: { official_url: null, key: 'x', title: 'X' },
			article_count: 11,
			changed_articles: 8,
			articles: ['1', '2', '3', '4', '5', '6', '7', '8'],
			new: false,
			publication: null,
			based_on: null
		});
		expect(veel.map(zin)).toEqual(['8 van 11 artikelen gewijzigd']);
	});
});

describe('the papers and articles a row is tied to', () => {
	const motie = {
		id: 'documents/m',
		kind: 'Motie',
		number: '31',
		dossier: '36764',
		surname: 'Kathmann',
		title: null,
		date: null,
		path: '/kamerstukken/36764/31',
		kind_group: 'motie' as const
	};

	it('names a motion a letter answers by its submitter and place', () => {
		const v = relatieVerbanden(item({ answers: [motie] }));
		expect(v.map(zin)).toEqual(['Gaat in op motie-Kathmann (36764, nr. 31)']);
		expect(v[0].delen[0]).toMatchObject({ ref: 'documents/m', href: '/kamerstukken/36764/31' });
	});

	it('names several commitments a letter answers by their numbers, the word once', () => {
		const tz = (number: string) => ({
			id: `commitments/${number}`,
			kind: 'toezegging',
			number,
			path: null
		});
		const v = relatieVerbanden(
			item({ answers: [tz('TZ202604-062'), tz('TZ202604-064'), tz('TZ202604-065')] })
		);
		expect(v.map(zin)).toEqual([
			'Gaat in op toezeggingen TZ202604-062, TZ202604-064 en TZ202604-065'
		]);
	});

	it('names a letter by its day where it has no number, and a commitment by its number', () => {
		expect(
			stukNaam({
				title: null,
				number: null,
				dossier: null,
				id: 'documents/b',
				kind: 'Brief regering',
				date: '2026-10-07',
				surname: 'Karremans',
				path: null,
				kind_group: 'brief'
			})
		).toBe('brief van 7\u00a0okt.\u00a02026');
		expect(
			stukNaam({
				title: null,
				date: null,
				dossier: null,
				surname: null,
				id: 'commitments/t',
				kind: 'toezegging',
				number: 'TZ202609-124',
				path: null,
				kind_group: null
			})
		).toBe('toezegging TZ202609-124');
		// Within its own dossier, the number alone.
		expect(stukNaam(motie, '36764')).toBe('motie-Kathmann (nr. 31)');
	});

	it('says the articles an amendment changes per law, the paper a changed one replaces', () => {
		const a = (number: string, effect: string | null = 'amends') => ({
			key: `bwbr0005537_${number}`,
			number,
			law: 'Algemene wet bestuursrecht',
			law_short: 'Awb',
			effect,
			path: `/wetten/BWBR0005537/artikel/${number}`
		});
		const v = relatieVerbanden(
			item({
				kind: 'Amendement',
				dossier: { key: '37022', number: '37022' },
				amends_articles: [a('3:2'), a('3:4'), a('4:5', 'introduces')],
				replaces: { id: 'documents/r', kind: 'Amendement', number: '9', dossier: '37022' }
			})
		);
		expect(v.map(zin)).toEqual([
			'Wijzigt art. 3:2 en 3:4 Awb',
			'Voegt in art. 4:5 Awb',
			'Ter vervanging van nr. 9'
		]);
	});

	it('names the articles a judgment cites, and nothing for a row tied to none', () => {
		const v = relatieVerbanden(
			item({
				kind: 'uitspraak',
				cites: [
					{ key: 'bwbr0030250_2_8', number: '2.8', law: 'Wet dieren' },
					{
						key: 'bwbr0005537_7_12',
						number: '7:12',
						law: 'Algemene wet bestuursrecht',
						law_short: 'Awb'
					}
				]
			})
		);
		expect(v.map(zin)).toEqual(['Noemt art. 2.8 Wet dieren en art. 7:12 Awb']);
		expect(relatieVerbanden(item({}))).toEqual([]);
	});
});

describe('how a row is tied to a followed law', () => {
	it('says it in the words of the relation', () => {
		expect(viaTekst({ dossier: null, relation: 'amends', article: '3' })).toBe('Wijzigt art. 3');
		expect(
			viaTekst({ dossier: null, relation: 'based_on', article: '68' }, 'Cyberbeveiligingswet')
		).toBe('Krachtens art. 68 Cyberbeveiligingswet');
		expect(viaTekst({ article: null, dossier: null, relation: 'establishes' })).toBe(
			'Stelt de wet vast'
		);
		expect(viaTekst({ article: null, relation: 'proposes', dossier: '36764' })).toBe(
			'In dossier 36764'
		);
		expect(viaTekst(null)).toBeNull();
	});

	it('puts the verb of a change around what it changes', () => {
		const wet = 'Cyberbeveiligingswet';
		expect(viaTekst({ dossier: null, relation: 'introduces', article: '5' }, wet)).toBe(
			'Voegt art. 5 Cyberbeveiligingswet in'
		);
		expect(viaTekst({ article: null, dossier: null, relation: 'introduces' }, wet)).toBe(
			'Voegt artikelen in Cyberbeveiligingswet in'
		);
		expect(viaTekst({ dossier: null, relation: 'repeals', article: '5' }, wet)).toBe(
			'Doet art. 5 Cyberbeveiligingswet vervallen'
		);
		expect(viaTekst({ article: null, dossier: null, relation: 'repeals' }, wet)).toBe(
			'Trekt Cyberbeveiligingswet in'
		);
	});
});

describe('the verbs of a change', () => {
	it('are those of a verbinding, for a publication’s laws and an amendment’s articles', () => {
		const effecten = ['establishes', 'amends', 'introduces', 'repeals'] as const;
		const v = publicatieVerbanden({
			series: 'stb',
			year: 2026,
			number: '1',
			citation: null,
			instruments: effecten.map((effect, n) => ({
				key: `bwbr${n}`,
				title: `Wet ${n}`,
				official_url: null,
				effect,
				article_count: null
			}))
		});
		expect(v.map((r) => r.label)).toEqual(
			effecten.map((e) =>
				capitalize(relationWords(e.toUpperCase() as Relation, 'instruments', 'articles').actief)
			)
		);
		const a = relatieVerbanden(
			item({
				amends_articles: (['amends', 'introduces', 'repeals'] as const).map((effect, n) => ({
					key: `bwbr0005537_${n}`,
					number: String(n),
					effect
				}))
			})
		);
		expect(a.map((r) => r.label)).toEqual(['Wijzigt', 'Voegt in', 'Doet vervallen']);
	});
});

describe('the tie to a followed law, once', () => {
	const cbw = { bwb: 'BWBR0052872', titel: 'Cyberbeveiligingswet' };
	it('leaves it out where the row says it already', () => {
		const pub = item({
			kind: 'publicatie',
			via: { relation: 'establishes' },
			publication: {
				instruments: [{ key: 'bwbr0052872', title: 'Cyberbeveiligingswet', effect: 'establishes' }]
			}
		});
		expect(viaRegel(pub, cbw)).toBeNull();
		const brief = item({
			via: { relation: 'legislated_in', dossier: '36764' },
			dossier: { key: '36764', number: '36764' }
		});
		expect(viaRegel(brief, cbw)).toBeNull();
		const amendement = item({
			kind: 'Amendement',
			via: { relation: 'proposes', article: '94' },
			amends_articles: [{ key: 'bwbr0052872_94', bwb_id: 'BWBR0052872', number: '94', path: null }]
		});
		expect(viaRegel(amendement, cbw)).toBeNull();
	});

	it('says it where the row does not: a regulation issued under one issued under the law', () => {
		const regeling = item({
			kind: 'inwerkingtreding',
			via: { relation: 'based_on', article: '68' },
			commencement: {
				instrument: { key: 'bwbr0053034', title: 'Cyberbeveiligingsregeling voor de zorg' },
				changed_articles: 8,
				new: false,
				based_on: {
					instrument: { key: 'bwbr0052875', title: 'Cyberbeveiligingsbesluit' },
					kind: 'amvb',
					articles: ['20']
				}
			}
		});
		expect(viaRegel(regeling, cbw)).toBe('Krachtens art. 68 Cyberbeveiligingswet');
		expect(viaRegel(regeling, null)).toBeNull();
	});
});
