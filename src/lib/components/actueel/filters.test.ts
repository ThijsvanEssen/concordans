import { describe, expect, it } from 'vitest';
import openapi from '$lib/api/openapi.json';
import { FILTER_PARAMS, feedQuery, readFilters, summaryQuery } from './filters';

const TODAY = '2026-10-14';
const read = (query: string) => readFilters(new URLSearchParams(query));

describe('readFilters: every filter of Actueel by its name in the address', () => {
	it('reads nothing from an empty address', () => {
		expect(read('')).toEqual({
			kinds: [],
			since: '',
			until: '',
			cabinet: '',
			ministry: '',
			dossier: '',
			member: '',
			faction: '',
			coalition: '',
			q: [],
			chamber: '',
			instrument: '',
			article: '',
			ahead: false
		});
	});

	it('reads the kinds, an old one as the TK word, each once', () => {
		expect(read('soort=Motie,motie,stemming,onzin').kinds).toEqual(['Motie', 'stemming']);
	});

	it('reads the period, the cabinet, the ministry, the dossier, the person and the fractie', () => {
		const f = read(
			'van=2026-01-01&tot=2026-02-01&kabinet=schoof&ministerie=fin&dossier=36600&persoon=p1&fractie=d66'
		);
		expect(f).toMatchObject({
			since: '2026-01-01',
			until: '2026-02-01',
			cabinet: 'schoof',
			ministry: 'fin',
			dossier: '36600',
			member: 'p1',
			faction: 'd66'
		});
	});

	it('reads the coalition in the words of the site, and nothing else', () => {
		expect(read('coalitie=verdeeld').coalition).toBe('verdeeld');
		expect(read('coalitie=split').coalition).toBe('');
	});

	it('reads every word searched, each a q of its own', () => {
		expect(read('q=huur&q=%20woning%20&q=&q=huur').q).toEqual(['huur', 'woning']);
	});

	it('reads the Kamer, TK or EK alone', () => {
		expect(read('kamer=EK').chamber).toBe('EK');
		expect(read('kamer=beide').chamber).toBe('');
	});

	it('reads a law or a treaty by its BWB id, and an article only with it', () => {
		expect(read('wet=bwbr0005289&artikel=6:162')).toMatchObject({
			instrument: 'BWBR0005289',
			article: '6:162'
		});
		expect(read('wet=BWBV0001000').instrument).toBe('BWBV0001000');
		expect(read('wet=onzin&artikel=3')).toMatchObject({ instrument: '', article: '' });
	});

	it('reads what lies ahead only when asked', () => {
		expect(read('komend=1').ahead).toBe(true);
		expect(read('komend=0').ahead).toBe(false);
	});
});

describe('FILTER_PARAMS: the names a shared link keeps', () => {
	it('names every filter by its name in the address', () => {
		expect(FILTER_PARAMS).toEqual([
			'soort',
			'van',
			'tot',
			'kabinet',
			'ministerie',
			'dossier',
			'persoon',
			'fractie',
			'coalitie',
			'q',
			'kamer',
			'wet',
			'artikel',
			'komend'
		]);
	});
});

describe('feedQuery: the filters as the feed asks them', () => {
	it('asks one filter per name, in the words of the API', () => {
		const q = feedQuery(
			read(
				'soort=Motie,stemming&van=2026-01-01&kabinet=schoof&ministerie=fin&dossier=36600&persoon=p1&fractie=d66&coalitie=verdeeld&q=huur&q=woning&kamer=TK&wet=BWBR0005289&artikel=6:162&komend=1'
			),
			TODAY
		);
		expect(q).toEqual({
			kind: 'Motie,stemming',
			since: '2026-01-01',
			cabinet: 'schoof',
			ministry: 'fin',
			dossier: '36600',
			member: 'p1',
			faction: 'd66',
			coalition: 'split',
			q: ['huur', 'woning'],
			chamber: 'TK',
			instrument: 'BWBR0005289',
			article: '6:162'
		});
	});

	it('asks an end only before today', () => {
		expect(feedQuery(read('tot=2026-10-01'), TODAY).until).toBe('2026-10-01');
		expect(feedQuery(read(`tot=${TODAY}`), TODAY).until).toBeUndefined();
		expect(feedQuery(read('tot=2026-12-01'), TODAY).until).toBeUndefined();
	});

	it('asks nothing for no filters', () => {
		expect(feedQuery(read(''), TODAY)).toEqual({});
	});
});

describe('summaryQuery: the day counts under the same filters', () => {
	const all = feedQuery(
		read(
			'soort=Motie&van=2026-01-01&tot=2026-02-01&kabinet=schoof&ministerie=fin&dossier=36600&persoon=p1&fractie=d66&coalitie=verdeeld&q=huur&kamer=TK&wet=BWBR0005289&artikel=6:162'
		),
		TODAY
	);

	it('keeps every filter but the period, which the summary asks of its own', () => {
		const { since, until, ...filters } = all;
		expect([since, until]).toEqual(['2026-01-01', '2026-02-01']);
		expect(summaryQuery(all)).toEqual(filters);
	});

	it('asks the summary only what it takes', () => {
		const taken = new Set(
			openapi.paths['/api/feed/summary'].get.parameters.map((p: { name: string }) => p.name)
		);
		expect(Object.keys(summaryQuery(all)).filter((k) => !taken.has(k))).toEqual([]);
	});
});
