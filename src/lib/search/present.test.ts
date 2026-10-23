import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import type { Collection } from '$lib/vocabulary';
import {
	bestHit,
	around,
	bySection,
	chamberOfHit,
	groupLabel,
	marked,
	orderGroups,
	presentHit,
	sectionOf,
	slots
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
	describe('a regeling', () => {
		const regeling = (key: string, extra: Record<string, unknown> = {}) =>
			hit({
				collection: 'instruments',
				key,
				display_name: 'Belastingen op milieugrondslag',
				extra: { bwb_id: key.toUpperCase(), ...extra }
			});
		it('is told apart by its kind and its day, not by its BWB id', () => {
			const a = regeling('bwbr0021767', {
				kind: 'beleidsregel',
				version_date_in_force: '2007-04-27'
			});
			const b = regeling('bwbr0022916', {
				kind: 'beleidsregel',
				version_date_in_force: '2008-06-12'
			});
			expect(presentHit(a, 'belasting', [a, b])).toEqual({
				title: 'Belastingen op milieugrondslag',
				context: 'Beleidsregel, 27\u00a0apr.\u00a02007',
				snippet: null
			});
			expect(presentHit(b, 'belasting', [a, b]).context).toBe(
				'Beleidsregel, 12\u00a0jun.\u00a02008'
			);
		});
		it('takes the day it was published first, then the day it came into force', () => {
			const both = {
				kind: 'wet',
				date_in_force: '1994-01-01',
				version_date_in_force: '2026-01-01'
			};
			expect(presentHit(regeling('bwbr0005537', both), 'x').context).toBe(
				'Wet, 1\u00a0jan.\u00a01994'
			);
			expect(
				presentHit(regeling('bwbr0005537', { ...both, date_published: '1992-06-04' }), 'x').context
			).toBe('Wet, 4\u00a0jun.\u00a01992');
		});
		it('keeps its BWB id where kind and day say no more than its neighbour', () => {
			const same = { kind: 'beleidsregel', version_date_in_force: '2007-04-27' };
			const a = regeling('bwbr0021767', same);
			const b = regeling('bwbr0022916', same);
			expect(presentHit(a, 'belasting', [a, b]).context).toBe(
				'Beleidsregel, 27\u00a0apr.\u00a02007, BWBR0021767'
			);
			expect(presentHit(a, 'belasting', [a]).context).toBe('Beleidsregel, 27\u00a0apr.\u00a02007');
		});
		it('names the BWB id where the API gives neither kind nor day', () => {
			const a = regeling('bwbr0021767');
			const b = regeling('bwbr0022916');
			expect(presentHit(a, 'belasting', [a, b]).context).toBe('BWBR0021767');
		});
	});
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

	it('cites a judgment as lawyers do (HR 19\u00a0februari\u00a01993), with the ECLI beside it', () => {
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
		expect(shown.title).toBe('HR 19\u00a0februari\u00a01993');
		expect(shown.context).toBe('ECLI:NL:HR:1993:ZC0870');
		expect(shown.snippet).not.toBeNull();
	});

	it('cites the court of a hit as the API cites a judgment: the Afdeling, a court by its place', () => {
		const titel = (ecli: string, display_name: string) =>
			presentHit(
				hit({ collection: 'judgments', key: ecli, display_name, extra: { ecli, names: [] } }),
				''
			).title;
		expect(titel('ECLI:NL:RVS:2026:5670', 'Raad van State 2026-09-03 / 202401234/1/R2')).toBe(
			'ABRvS 3\u00a0september\u00a02026'
		);
		expect(titel('ECLI:NL:RBDHA:2026:1', 'Rechtbank Den Haag 2026-07-06 / C/09/1')).toBe(
			'Rb. Den Haag 6\u00a0juli\u00a02026'
		);
		expect(titel('ECLI:NL:GHSGR:2010:BN1234', "Gerechtshof 's-Gravenhage 2010-08-24 / 1")).toBe(
			"Hof 's-Gravenhage 24\u00a0augustus\u00a02010"
		);
		expect(titel('ECLI:NL:CRVB:2026:404', 'Centrale Raad van Beroep 2026-02-11 / 24/1')).toBe(
			'CRvB 11\u00a0februari\u00a02026'
		);
		expect(titel('ECLI:CE:ECHR:2026:0908JUD000748123', 'EHRM 2026-09-08 / 7481/23')).toBe(
			'EHRM 8\u00a0september\u00a02026'
		);
	});

	it('names a stuk by its kind, under the dossier it belongs to', () => {
		const shown = presentHit(stuk('a', 'Nader rapport'), 'nadeel');
		expect(shown.title).toBe('Nader rapport');
		expect(shown.snippet).toBeNull();
		expect(sectionOf(stuk('a', 'Eindtekst'))).toBe(`Dossier 32621 ${TITLE}`);
	});

	it('gives a stuk its number in the dossier, where the API has one', () => {
		const amendement = hit({
			collection: 'documents',
			key: 'b',
			display_name: TITLE,
			extra: { kind: 'Amendement', dossier_number: '37022', sequence: '8' }
		});
		expect(presentHit(amendement, 'x').title).toBe('Amendement, Kamerstukken II, 37022, nr. 8');
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
		).toBe('HR 20\u00a0december\u00a02019 (Urgenda)');
		expect(
			presentHit(
				urgenda('b', 'ECLI:NL:HR:2019:2007', 'Hoge Raad 2019-12-20 / 19/00135 (Engels)'),
				''
			).title
		).toBe('HR 20\u00a0december\u00a02019 (Urgenda), Engelse vertaling');
		expect(
			presentHit(
				urgenda(
					'c',
					'ECLI:NL:RBDHA:2015:7196',
					'Rechtbank Den Haag 2015-06-24 / C/09/456689 / HA ZA 13-1396 (English translation)'
				),
				''
			).title
		).toBe('Rb. Den Haag 24\u00a0juni\u00a02015 (Urgenda), Engelse vertaling');
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
		expect(presentHit(stenogram, '').context).toBe('Stenogram, 22\u00a0mei\u00a02025');
		const motie = {
			...stuk('m', 'Motie'),
			extra: { kind: 'Motie', dossier_number: '32621', sequence: 21, date: '2026-09-07' }
		};
		expect(presentHit(motie, '')).toMatchObject({
			title: 'Motie, Kamerstukken II 2025/26, 32621, nr. 21',
			context: '7\u00a0sep.\u00a02026'
		});
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
			context: '2\u00a0jul.\u00a02024 tot 23\u00a0feb.\u00a02026'
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
			context: 'TZ202609-117, 29\u00a0sep.\u00a02026'
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
			context: 'aangenomen, 29\u00a0sep.\u00a02026',
			snippet: null,
			chamber: 'EK'
		});
	});
});

describe('bestHit', () => {
	type H = Schema<'SearchResultItem'>;
	const hit = (id: string, collection: string, score: number) =>
		({ id, key: id, collection, display_name: id, score }) as unknown as H;
	const group = (kind: Collection, ...hits: H[]) => ({ kind, hits });

	it('leads with the rule where it scores nearly as well: huurverhoging', () => {
		const best = bestHit([
			group('documents', hit('kamervragen', 'documents', 0.25)),
			group('dossiers', hit('36511', 'dossiers', 0.25)),
			group('articles', hit('7:248', 'articles', 0.1), hit('7:253', 'articles', 0.1))
		]);
		expect(best?.hit.id).toBe('7:248');
	});

	it('keeps a name that fits far better on top: a fractie for PVV', () => {
		const best = bestHit([
			group('factions', hit('pvv', 'factions', 0.75)),
			group('articles', hit('art', 'articles', 0.1))
		]);
		expect(best?.hit.id).toBe('pvv');
	});

	it('takes an identifier first, and says nothing for one group', () => {
		expect(
			bestHit([
				group('articles', hit('art', 'articles', 0.5)),
				group('judgments', hit('ecli', 'judgments', 1))
			])?.hit.id
		).toBe('ecli');
		expect(bestHit([group('articles', hit('art', 'articles', 0.5))])).toBeNull();
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
		expect(sectionOf(stuk36496)).toBe('Dossier 36496 Wet betaalbare huur');
		const beschreven = maak({
			collection: 'dossiers',
			key: '36311',
			display_name: 'Wijziging van de Wet op de huurtoeslag (vereenvoudiging van de huurtoeslag)'
		});
		expect(presentHit(beschreven, 'huur').snippet).toBeNull();
	});
});

describe('slots (UX-toets 0.79.47, #52)', () => {
	const ORDER = ['instruments', 'articles', 'judgments', 'dossiers'] as const;
	const h = (id: string) => ({ id });
	const kinds = (v: { kind: string; best: boolean; pending: boolean }[]) =>
		v.map((x) => (x.best ? 'beste' : x.pending ? `${x.kind}…` : x.kind));

	it('keeps one order whichever answer comes first', () => {
		const vroeg = slots(ORDER, [{ kind: 'judgments', hits: [h('j')] }], null);
		const laat = slots(
			ORDER,
			[
				{ kind: 'dossiers', hits: [h('d')] },
				{ kind: 'judgments', hits: [h('j')] },
				{ kind: 'articles', hits: [h('a')] }
			],
			null
		);
		expect(kinds(vroeg)).toEqual(['judgments']);
		expect(kinds(laat)).toEqual(['articles', 'judgments', 'dossiers']);
	});

	it('holds the place of a group still coming', () => {
		const v = slots(ORDER, [{ kind: 'dossiers', hits: [h('d')] }], null, (k) => k === 'judgments');
		expect(kinds(v)).toEqual(['judgments…', 'dossiers']);
	});

	it('puts the Beste treffer on top, out of its own group', () => {
		const v = slots(
			ORDER,
			[
				{ kind: 'articles', hits: [h('a1'), h('a2')] },
				{ kind: 'dossiers', hits: [h('d')] }
			],
			{ kind: 'articles', hit: h('a1') }
		);
		expect(kinds(v)).toEqual(['beste', 'articles', 'dossiers']);
		expect(v[1].hits.map((x) => x.id)).toEqual(['a2']);
	});
});

describe('a judgment found by a person', () => {
	const gevonden = (person: Record<string, unknown>) =>
		hit({
			collection: 'judgments',
			key: 'ecli_nl_rvs_2007_bb0782',
			display_name: 'Raad van State 2007-08-01 / 200604968/1',
			snippet: 'Inhoudsindicatie.',
			extra: { ecli: 'ECLI:NL:RVS:2007:BB0782', names: [], person }
		});
	const tekst = (s: { text: string }[] | null) => s?.map((d) => d.text).join('');

	it('says who acts for whom under the hit, the name marked', () => {
		const shown = presentHit(
			gevonden({ name: 'mr. drs. R. van Gelder', role: 'advocaat', party: '[appellanten]' }),
			'R. van Gelder'
		);
		expect(tekst(shown.snippet)).toBe('mr. drs. R. van Gelder, advocaat van [appellanten]');
		expect(shown.snippet?.filter((d) => d.mark).map((d) => d.text)).toEqual(['van', 'Gelder']);
	});

	it('says the role of a party, and keeps the text of a hit not found by a person', () => {
		const partij = presentHit(
			gevonden({
				name: 'het college van gedeputeerde staten van Zuid-Holland',
				role: 'Verweerder',
				party: null
			}),
			'gedeputeerde staten'
		);
		expect(tekst(partij.snippet)).toBe(
			'het college van gedeputeerde staten van Zuid-Holland, verweerder'
		);
		expect(tekst(presentHit(gevonden({}), 'x').snippet)).toBe('Inhoudsindicatie.');
	});
});

describe('a hit that has expired (besluit 30)', () => {
	const law = (extra: Record<string, unknown>) =>
		({
			id: 'instruments/bwbr0001',
			collection: 'instruments',
			display_name: 'Oude wet',
			extra
		}) as unknown as Parameters<typeof presentHit>[0];

	it('says vervallen once its day has passed', () => {
		const shown = presentHit(law({ expired_on: '2020-01-01' }), 'wet', [], new Date(2026, 9, 22));
		expect(shown.expired).toBe('Vervallen per 1\u00a0januari\u00a02020');
	});
	it('says nothing of a law that holds, or lapses later', () => {
		expect(presentHit(law({}), 'wet', [], new Date(2026, 9, 22)).expired).toBeUndefined();
		expect(
			presentHit(law({ expired_on: '2027-01-01' }), 'wet', [], new Date(2026, 9, 22)).expired
		).toBeUndefined();
	});
});

describe('a motion of censure or no confidence (API 0.80.5)', () => {
	const motie = (motion_kind?: string) =>
		hit({
			collection: 'documents',
			key: 'm1',
			display_name: 'Motie van het lid Wilders',
			extra: { kind: 'Motie', motion_kind, date: '2026-10-01' }
		});

	it('is told by its kind, whatever the source calls it', () => {
		expect(presentHit(motie('no_confidence'), 'wantrouwen', []).context).toContain(
			'Motie van wantrouwen'
		);
		expect(presentHit(motie('censure'), 'afkeuring', []).context).toContain('Motie van afkeuring');
	});

	it('stays a Motie without a kind', () => {
		expect(presentHit(motie(), 'motie', []).context).toContain('Motie');
		expect(presentHit(motie(), 'motie', []).context).not.toContain('wantrouwen');
	});
});
