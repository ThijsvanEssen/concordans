import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import type { Collection } from '$lib/vocabulary';
import {
	besteTreffer,
	around,
	bySection,
	chamberOfHit,
	groupLabel,
	marked,
	orderGroups,
	presentHit,
	sectionOf
} from './present';

type Hit = Schema<'SearchResultItem'>;
const hit = (h: Partial<Hit> & Pick<Hit, 'collection' | 'key'>): Hit =>
	({ id: `${h.collection}/${h.key}`, type: '', display_name: null, score: 1, ...h }) as Hit;

const TITLE = 'Aanvulling van de Algemene wet bestuursrecht met bepalingen over nadeelcompensatie';
const stuk = (key: string, kind: string, dossier = '32621') =>
	hit({
		collection: 'documents',
		key,
		display_name: TITLE,
		snippet: kind,
		extra: { kind, dossier_number: dossier }
	});

describe('presentHit', () => {
	it('gives an article its book number, the code it is cited by, and a line of its text', () => {
		const shown = presentHit(
			hit({
				collection: 'articles',
				key: 'bwbr0005289_164',
				snippet: 'kan aan hem niet als een onrechtmatige daad worden toegerekend.',
				extra: {
					bwb_id: 'BWBR0005289',
					article_number: '164',
					citation_title: 'Burgerlijk Wetboek Boek 6',
					short_title: 'BW6'
				}
			}),
			'onrechtmatige daad'
		);
		expect(shown.title).toBe('Artikel 6:164');
		expect(shown.context).toBe('BW');
		expect(shown.snippet?.filter((s) => s.mark).map((s) => s.text)).toEqual([
			'onrechtmatige',
			'daad'
		]);
	});

	it('cites a judgment as lawyers do (HR 19 februari 1993), with the ECLI beside it', () => {
		const shown = presentHit(
			hit({
				collection: 'judgments',
				key: 'ecli_nl_hr_1993_zc0870',
				display_name: 'Hoge Raad 1993-02-19 / 14892',
				snippet: 'Onrechtmatige daad overheid.',
				extra: { ecli: 'ECLI:NL:HR:1993:ZC0870', names: [] }
			}),
			'daad'
		);
		expect(shown.title).toBe('HR 19 februari 1993');
		expect(shown.context).toBe('ECLI:NL:HR:1993:ZC0870');
		expect(shown.snippet).not.toBeNull();
	});

	it('names a stuk by its kind, under the dossier it belongs to', () => {
		const shown = presentHit(stuk('a', 'Nader rapport'), 'nadeel');
		expect(shown.title).toBe('Nader rapport');
		expect(shown.snippet).toBeNull();
		expect(sectionOf(stuk('a', 'Eindtekst'))).toBe(`32621 ${TITLE}`);
	});

	it('gives a stuk its number in the dossier, where the API has one', () => {
		const amendement = hit({
			collection: 'documents',
			key: 'b',
			display_name: TITLE,
			extra: { kind: 'Amendement', dossier_number: '37022', sequence: '8' }
		});
		expect(presentHit(amendement, 'x').title).toBe('Amendement, nr. 8');
	});

	it('names a stuk outside a dossier by its own name, with its kind beside it', () => {
		const stenogram = hit({
			collection: 'documents',
			key: 'c',
			display_name: 'Stikstof en natuur',
			extra: { kind: 'Stenogram', dossier_number: null, sequence: null }
		});
		expect(presentHit(stenogram, 'stikstof')).toMatchObject({
			title: 'Stikstof en natuur',
			context: 'Stenogram'
		});
	});
});

describe('two judgments of one name', () => {
	const urgenda = (key: string, ecli: string, name: string) =>
		hit({
			collection: 'judgments',
			key,
			display_name: name,
			extra: { ecli, names: ['Urgenda'] }
		});

	it('tells the translation from the original by the name the court gives it', () => {
		expect(
			presentHit(urgenda('a', 'ECLI:NL:HR:2019:2006', 'Hoge Raad 2019-12-20 / 19/00135'), '').title
		).toBe('HR 20 december 2019 (Urgenda)');
		expect(
			presentHit(
				urgenda('b', 'ECLI:NL:HR:2019:2007', 'Hoge Raad 2019-12-20 / 19/00135 (Engels)'),
				''
			).title
		).toBe('HR 20 december 2019 (Urgenda), Engelse vertaling');
		expect(
			presentHit(
				urgenda(
					'c',
					'ECLI:NL:RBDHA:2015:7196',
					'Rechtbank Den Haag 2015-06-24 / C/09/456689 / HA ZA 13-1396 (English translation)'
				),
				''
			).title
		).toBe('Rb. Den Haag 24 juni 2015 (Urgenda), Engelse vertaling');
	});

	it('gives a judgment that is only cited the year of its ECLI', () => {
		const lindenbaum = hit({
			collection: 'judgments',
			key: 'ecli_nl_hr_1919_ag1776',
			extra: { ecli: 'ECLI:NL:HR:1919:AG1776', names: ['Lindenbaum/Cohen'] }
		});
		expect(presentHit(lindenbaum, '').title).toBe('HR 1919 (Lindenbaum/Cohen)');
	});
});

describe('the Kamer of a hit', () => {
	it('marks a stuk with the Kamer the API gives, and none where it gives none', () => {
		const ek = { ...stuk('ek_kst_1269940', 'Brief'), extra: { kind: 'Brief', chamber: 'EK' } };
		expect(chamberOfHit(ek)).toBe('EK');
		expect(presentHit(ek, '').chamber).toBe('EK');
		expect(chamberOfHit(stuk('ek_kst_1269940', 'Brief'))).toBeUndefined();
	});

	it('dates a stuk: a stenogram beside its kind, a Kamerstuk under its dossier', () => {
		const stenogram = hit({
			collection: 'documents',
			key: 'c',
			display_name: 'Stikstof en natuur',
			extra: { kind: 'Stenogram', date: '2025-05-22', chamber: 'TK' }
		});
		expect(presentHit(stenogram, '').context).toBe('Stenogram, 22 mei 2025');
		const motie = {
			...stuk('m', 'Motie'),
			extra: { kind: 'Motie', dossier_number: '32621', sequence: 21, date: '2026-09-07' }
		};
		expect(presentHit(motie, '')).toMatchObject({ title: 'Motie, nr. 21', context: '7 sep. 2026' });
	});

	it('takes the Kamer the API gives over the key', () => {
		const given = hit({
			collection: 'documents',
			key: 'x',
			extra: { kind: 'Brief', chamber: 'EK' }
		});
		expect(chamberOfHit(given)).toBe('EK');
	});

	it('marks nothing but stukken, and heads the members as Leden', () => {
		expect(chamberOfHit(hit({ collection: 'members', key: 'ek_a_kanis_d66' }))).toBeUndefined();
		expect(groupLabel('members')).toBe('Leden');
		expect(groupLabel('dossiers')).toBe('Dossiers');
	});
});

describe('bySection', () => {
	it('keeps the stukken of one dossier together, in the order the dossiers first appear', () => {
		const order = bySection([
			stuk('a', 'Eindtekst'),
			stuk('b', 'Brief', '36000'),
			stuk('c', 'Amendement')
		]).map((h) => h.key);
		expect(order).toEqual(['a', 'c', 'b']);
	});
});

describe('around', () => {
	it('starts the line a little before the first word searched for', () => {
		const text = `${'Een gedraging van een kind dat de leeftijd van veertien jaren nog niet heeft bereikt, kan aan hem niet als een'} onrechtmatige daad worden toegerekend.`;
		const line = around(text, 'onrechtmatige');
		expect(line.startsWith('…')).toBe(true);
		expect(line.indexOf('onrechtmatige')).toBeLessThanOrEqual(42);
		expect(around('Onrechtmatige daad overheid.', 'daad')).toBe('Onrechtmatige daad overheid.');
	});
});

describe('marked', () => {
	it('leaves short words and other text alone', () => {
		expect(marked('art. 6:162 BW', 'bw')).toEqual([{ text: 'art. 6:162 BW', mark: false }]);
	});
});

describe('orderGroups', () => {
	const g = (kind: Hit['collection'], ...scores: number[]) => ({
		kind: kind as never,
		hits: scores.map((score, i) => hit({ collection: kind, key: `${kind}${i}`, score }))
	});

	it('puts the group with the best hit first: a fractie before judgments that contain its name', () => {
		const order = orderGroups([g('judgments', 0.25, 0.1), g('members', 0.1), g('factions', 1, 1)]);
		expect(order.map((x) => x.kind)).toEqual(['factions', 'judgments', 'members']);
	});

	it('names debates before judgments for a subject', () => {
		const order = orderGroups([g('judgments', 0.1), g('dossiers', 0.25), g('documents', 0.5)]);
		expect(order.map((x) => x.kind)).toEqual(['documents', 'dossiers', 'judgments']);
	});

	it('puts a name first on a tie', () => {
		const order = orderGroups([g('documents', 0.25), g('dossiers', 0.25), g('members', 0.25)]);
		expect(order.map((x) => x.kind)).toEqual(['members', 'dossiers', 'documents']);
	});
});

describe('a cabinet', () => {
	it('is named with its period', () => {
		const schoof = hit({
			collection: 'cabinets',
			key: 'schoof',
			display_name: 'kabinet-Schoof',
			extra: { from_date: '2024-07-02', to_date: '2026-02-23' }
		});
		expect(presentHit(schoof, 'schoof')).toMatchObject({
			title: 'kabinet-Schoof',
			context: '2 jul. 2024 tot 23 feb. 2026'
		});
	});
});

describe('a toezegging', () => {
	it('is named by its text, with its number and day', () => {
		const tz = hit({
			collection: 'commitments',
			key: 't',
			display_name: 'De Kamer ontvangt de rapportage mensenhandel',
			extra: { number: 'TZ202609-117', made_on: '2026-09-29', status: 'Openstaand' }
		});
		expect(presentHit(tz, 'mensenhandel')).toMatchObject({
			title: 'De Kamer ontvangt de rapportage mensenhandel',
			context: 'TZ202609-117, 29 sep. 2026'
		});
	});
});

describe('a vote as a hit', () => {
	it('is named by its subject, with outcome, day and Kamer from the source', () => {
		const hit = {
			id: 'decisions/ek_2026_09_29_36791_1',
			key: 'ek_2026_09_29_36791_1',
			collection: 'decisions',
			display_name: 'Eerste Kamer 2026-09-29: Wet toekomstbestendige huurcommissie (36.791)',
			extra: { date: '2026-09-29', passed: true, chamber: 'EK' }
		} as unknown as Hit;
		expect(presentHit(hit, 'huurcommissie')).toEqual({
			title: 'Wet toekomstbestendige huurcommissie (36.791)',
			context: 'aangenomen, 29 sep. 2026',
			snippet: null,
			chamber: 'EK'
		});
	});
});

describe('besteTreffer', () => {
	type H = Schema<'SearchResultItem'>;
	const hit = (id: string, collection: string, score: number) =>
		({ id, key: id, collection, display_name: id, score }) as unknown as H;
	const group = (kind: Collection, ...hits: H[]) => ({ kind, hits });

	it('leads with the rule where it scores nearly as well: huurverhoging', () => {
		const best = besteTreffer([
			group('documents', hit('kamervragen', 'documents', 0.25)),
			group('dossiers', hit('36511', 'dossiers', 0.25)),
			group('articles', hit('7:248', 'articles', 0.1), hit('7:253', 'articles', 0.1))
		]);
		expect(best?.hit.id).toBe('7:248');
	});

	it('keeps a name that fits far better on top: a fractie for PVV', () => {
		const best = besteTreffer([
			group('factions', hit('pvv', 'factions', 0.75)),
			group('articles', hit('art', 'articles', 0.1))
		]);
		expect(best?.hit.id).toBe('pvv');
	});

	it('takes an identifier first, and says nothing for one group', () => {
		expect(
			besteTreffer([
				group('articles', hit('art', 'articles', 0.5)),
				group('judgments', hit('ecli', 'judgments', 1))
			])?.hit.id
		).toBe('ecli');
		expect(besteTreffer([group('articles', hit('art', 'articles', 0.5))])).toBeNull();
	});
});

describe('citeertitel', () => {
	it('names a bill by its citation title, the long title below (Z5)', () => {
		const maak = (h: Partial<Hit> & Pick<Hit, 'collection' | 'key'>): Hit =>
			({ id: `${h.collection}/${h.key}`, type: '', display_name: null, score: 1, ...h }) as Hit;
		const lang =
			'Wijziging van de Wet goed verhuurderschap, Boek 7 van het Burgerlijk Wetboek en enige andere wetten in verband met de regulering van huurprijzen (Wet betaalbare huur)';
		const dossier = maak({
			collection: 'dossiers',
			key: '36496',
			display_name: lang,
			extra: { number: '36496', outcome: 'aangenomen' }
		});
		const shown = presentHit(dossier, 'huur');
		expect(shown.title).toBe('Wet betaalbare huur');
		expect(shown.snippet).toEqual([{ text: lang, mark: false }]);
		const zonder = maak({ collection: 'dossiers', key: '1', display_name: TITLE, extra: {} });
		expect(presentHit(zonder, 'x')).toMatchObject({ title: TITLE, snippet: null });
		const stuk36496 = maak({
			collection: 'documents',
			key: 'd',
			display_name: lang,
			extra: { kind: 'Memorie van toelichting', dossier_number: '36496' }
		});
		expect(sectionOf(stuk36496)).toBe('36496 Wet betaalbare huur');
		const beschreven = maak({
			collection: 'dossiers',
			key: '36311',
			display_name: 'Wijziging van de Wet op de huurtoeslag (vereenvoudiging van de huurtoeslag)'
		});
		expect(presentHit(beschreven, 'huur').snippet).toBeNull();
	});
});
