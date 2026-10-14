import { describe, expect, it } from 'vitest';
import { kandidaten, schetsVan, type CitedBy } from './wetsnetwerk';
import type { ChangedArticles } from '$lib/components/parliamentary/changed-articles';

const vote = (number: string, date: string, chamber: 'TK' | 'EK', subkind: string, passed = true) =>
	({
		id: `decisions/${number}-${chamber}`,
		kind: 'stemming',
		date,
		title: `Wet ${number}`,
		subkind,
		node: { collection: 'decisions', key: `${number}-${chamber}` },
		dossier: { key: number, number, title: `Wet ${number}`, short_title: `Wet ${number}` },
		vote: { chamber, passed, tally: {} }
	}) as never;

describe('kandidaten', () => {
	it('keeps the passed votes on a law, newest first, the Eerste Kamer first on one day', () => {
		const ks = kandidaten([
			vote('36799', '2026-09-29', 'TK', 'Wetgeving'),
			vote('36547', '2026-09-29', 'EK', 'Wetgeving'),
			vote('36945-A', '2026-09-30', 'EK', 'Begroting'),
			vote('36900', '2026-09-30', 'TK', 'Wetgeving', false),
			vote('36100', '2026-09-22', 'TK', 'Initiatiefwetgeving')
		]);
		expect(ks.map((k) => k.number)).toEqual(['36547', '36799', '36100']);
		expect(ks[0]).toMatchObject({ kamer: 'EK', datum: '2026-09-29', naam: 'Wet 36547' });
	});

	it('names each dossier once, at its newest vote', () => {
		const ks = kandidaten([
			vote('36547', '2026-06-10', 'TK', 'Wetgeving'),
			vote('36547', '2026-09-29', 'EK', 'Wetgeving')
		]);
		expect(ks).toHaveLength(1);
		expect(ks[0].kamer).toBe('EK');
	});
});

const change = (art: string, nr: string, soort: string) => ({
	article: {
		id: `articles/bwbr0001854_${art}`,
		key: `bwbr0001854_${art}`,
		article_number: art,
		display_name: `Artikel ${art} Wetboek van Strafrecht`,
		stub: false
	},
	relation: 'amends',
	stage: 'proposed',
	source: {
		id: `documents/d${nr}`,
		key: `d${nr}`,
		// The name is the API's own; the number and the kind are read from their fields.
		display_name: `Wijziging van het Wetboek van Strafrecht`,
		official_id: null,
		kind: soort,
		sequence: Number(nr),
		number: nr
	},
	effective_date: null
});

const changes = {
	number: '36547',
	total: 7,
	articles: 5,
	enacted: 0,
	proposed: 7,
	laws: [
		{
			law: {
				id: 'instruments/bwbr0001854',
				bwb_id: 'BWBR0001854',
				celex: null,
				display_name: 'Wetboek van Strafrecht'
			},
			total: 6,
			changes: [
				change('9', '2', 'Voorstel van wet'),
				change('273f', '2', 'Voorstel van wet'),
				change('273f', '7', 'Nota van wijziging'),
				change('273f', '20', 'Amendement'),
				change('160', '22', 'Amendement'),
				change('77d', '2', 'Voorstel van wet')
			]
		},
		{
			law: {
				id: 'instruments/bwbr0028180',
				bwb_id: 'BWBR0028180',
				celex: null,
				display_name: 'Wetboek van Strafrecht BES'
			},
			total: 1,
			changes: [change('9', '2', 'Voorstel van wet')]
		}
	]
} as unknown as ChangedArticles;

const judgment = (ecli: string, count: number) => ({
	judgment: {
		id: `judgments/${ecli}`,
		key: ecli,
		ecli,
		court: 'HR',
		tier: 'hoge_raad',
		court_kind: 'hoge_raad',
		date: '2009-10-27',
		display_name: 'Hoge Raad 2009-10-27 / 08/03895',
		inbound_citation_count: count
	}
});

const citedBy = {
	article_id: 'articles/bwbr0001854_273f',
	total: 4,
	judgment_total: 39,
	echr_judgment_total: 0,
	items: [judgment('A', 264), judgment('A', 264), judgment('B', 167), judgment('C', 3)]
} as unknown as CitedBy;

const k = { number: '36547', naam: 'Wet mensenhandel', datum: '2026-09-29', kamer: 'EK' as const };

describe('schetsVan', () => {
	const s = schetsVan(k, changes, citedBy)!;

	it('draws the dossier, its stukken by number with the amendments as one, the law, the judgments', () => {
		expect(s.kolommen.map((c) => c.titel)).toEqual([
			'Dossier',
			'Stukken die wijzigen',
			'Gewijzigde artikelen',
			'Uitspraken over artikel 273f'
		]);
		expect(s.kolommen[1].bronnen.map((b) => b.label)).toEqual([
			'Voorstel van wet',
			'Nota van wijziging',
			'2 amendementen'
		]);
		expect(s.kolommen[1].bronnen.map((b) => b.sub ?? null)).toEqual(['nr. 2', 'nr. 7', null]);
		expect(s.kolommen[2].kader?.label).toBe('Wetboek van Strafrecht');
		expect(s.kolommen[2].na?.label).toBe('en 1 andere wet');
	});

	it('puts the most changed article first, and each judgment once', () => {
		expect(s.kolommen[2].bronnen[0].label).toBe('Artikel 273f');
		expect(s.kolommen[3].bronnen.map((b) => b.label)).toEqual(['A', 'B', '39 uitspraken']);
		expect(s.kolommen[3].bronnen[0].sub).toBe('Hoge Raad 27 oktober 2009, 264× aangehaald');
	});

	it('links each stuk to the articles it changes', () => {
		expect(s.lijnen).toContainEqual(['documents/d7', 'articles/bwbr0001854_273f']);
		expect(s.lijnen).toContainEqual(['groep/amendementen', 'articles/bwbr0001854_160']);
		expect(s.lijnen).toContainEqual(['articles/bwbr0001854_273f', 'judgments/A']);
	});

	it('counts the chain for a narrow screen', () => {
		expect(s.keten).toEqual({
			stukken: 4,
			artikelen: 4,
			wet: 'Wetboek van Strafrecht',
			uitspraken: 39,
			artikel: 'Artikel 273f'
		});
	});

	it('opens the Verkenner on at least what the band draws: every stuk, every law', () => {
		expect(s.verkenner).toBe(
			'/explore?netwerk=dossiers/36547,documents/d2,documents/d7,documents/d20,documents/d22,' +
				'instruments/bwbr0001854,instruments/bwbr0028180,articles/bwbr0001854_273f,judgments/A,judgments/B'
		);
	});

	it('leaves the judgments out when none cites the article', () => {
		const zonder = schetsVan(k, changes, { ...citedBy, judgment_total: 0, items: [] })!;
		expect(zonder.kolommen).toHaveLength(3);
	});
});
