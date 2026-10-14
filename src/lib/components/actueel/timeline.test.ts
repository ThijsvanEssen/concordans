import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import type { FeedItem } from './feed';
import {
	commitmentTitle,
	dayLines,
	dossierName,
	headSurname,
	headlineOf,
	inWords,
	timelineOf,
	voteHow
} from './timeline';

let n = 0;
const item = (over: Partial<FeedItem>): FeedItem =>
	({
		id: `x/${++n}`,
		kind: 'Motie',
		date: '2026-09-22',
		title: null,
		summary: null,
		subkind: null,
		node: { collection: 'documents', key: `k${n}` },
		dossier: null,
		persons: [],
		headline: {},
		...over
	}) as FeedItem;

const vote = (voor: number, tegen: number, over: Partial<FeedItem> = {}) =>
	item({
		kind: 'stemming',
		subkind: 'Motie',
		node: { collection: 'decisions', key: `d${n}` } as FeedItem['node'],
		vote: {
			chamber: 'TK',
			passed: voor > tegen,
			outcome: voor > tegen ? 'aangenomen' : 'verworpen',
			tally: { Voor: voor, Tegen: tegen }
		} as FeedItem['vote'],
		...over
	});

type Day = Schema<'FeedDayDTO'>;
const day = (over: Partial<Day> = {}): Day => ({ date: '2026-09-22', total: 1, ...over });

const schilder = vote(75, 75, {
	persons: [{ name: 'Joost Schilder', surname: 'Schilder', role: 'indiener' } as never],
	headline: { surname: 'Schilder', subject: 'strafverzwaring' }
});

describe('headSurname', () => {
	it('sets a surname at the head of a phrase', () => {
		expect(headSurname('van den Berg')).toBe('Van den Berg');
		expect(headSurname(null)).toBe('');
	});
});

describe('dossierName', () => {
	it('takes the official short title, and names an amended law as its change', () => {
		expect(
			dossierName({
				number: '37014',
				short_title: 'Wet weerbare waarden',
				short_title_basis: 'title'
			})
		).toBe('Wet weerbare waarden');
		expect(
			dossierName({
				number: '36889',
				title: 'Wijziging van de Archiefwet 1995 ter verruiming van de mogelijkheden',
				short_title: 'Archiefwet 1995',
				short_title_basis: 'amended_law'
			})
		).toBe('wijziging van Archiefwet 1995');
	});

	it('falls back on the title, cut, and on the number', () => {
		const title =
			'Vaststelling van de begrotingsstaten van Koninkrijksrelaties (IV) en het BES-fonds (H) voor het jaar 2027';
		expect(dossierName({ number: '37020-IV', title })).toBe(`${title.slice(0, 79).trimEnd()}…`);
		expect(dossierName({ number: '36892', title: 'Wijziging van de Gemeentewet' })).toBe(
			'Wijziging van de Gemeentewet'
		);
		expect(dossierName({ number: '36000' })).toBe('36000');
	});
});

describe('inWords', () => {
	it('writes small numbers out', () => {
		expect(inWords(6)).toBe('zes');
		expect(inWords(14)).toBe('14');
	});
});

describe('commitmentTitle', () => {
	it('names the bewindspersoon by the post they signed as', () => {
		const persons = [
			{
				name: 'Hans Vijlbrief',
				surname: 'Vijlbrief',
				function: 'Minister van Sociale Zaken en Werkgelegenheid'
			} as never
		];
		expect(
			commitmentTitle(
				item({
					kind: 'toezegging',
					summary: 'De minister komt in de startbrief terug op het nabestaandenpensioen.',
					persons
				})
			)
		).toBe('Minister Vijlbrief komt in de startbrief terug op het nabestaandenpensioen.');
		expect(
			commitmentTitle(item({ kind: 'toezegging', summary: 'Een brief volgt.', persons }))
		).toBe('Minister Vijlbrief: Een brief volgt.');
	});
});

describe('dayLines', () => {
	it('shows the bills and the close votes alone, and counts the other votes', () => {
		const bills = ['36889', '36899'].map((number) =>
			vote(100, 50, {
				subkind: 'Wetgeving',
				dossier: {
					key: number,
					number,
					title: `Wijziging van de Wet ${number} in verband met iets`,
					short_title: `Wet ${number}`,
					short_title_basis: 'amended_law'
				} as never
			})
		);
		const lines = dayLines(
			day({
				votes: [
					{ chamber: 'TK', subkind: 'Wetgeving', outcome: 'aangenomen', count: 2 },
					{ chamber: 'TK', subkind: 'Motie', outcome: 'aangenomen', count: 88 },
					{ chamber: 'TK', subkind: 'Motie', outcome: 'verworpen', count: 37 },
					{ chamber: 'TK', subkind: 'Amendement', outcome: 'aangenomen', count: 9 }
				]
			}),
			[...bills, schilder]
		);
		expect(lines.map((l) => l.title)).toEqual([
			'Tweede Kamer neemt twee wetsvoorstellen aan',
			'Tweede Kamer verwerpt motie-Schilder over strafverzwaring',
			'Tweede Kamer stemt over 125 moties: 88 aangenomen, 37 verworpen'
		]);
		expect(lines[0].context).toBe('wijziging van Wet 36889 en wijziging van Wet 36899');
		expect(lines.map((l) => l.teken)).toEqual(['ja', 'nee', 'stuk']);
		expect(lines[1].context).toBe('75 voor, 75 tegen');
		expect(lines[2].context).toBe('Ook 9 amendementen');
		expect(lines[2].href).toBe('/actueel?van=2026-09-22&tot=2026-09-22&soort=stemming');
	});

	it('names the Eerste Kamer when it decides a bill, and keeps it out of the Kamer’s count', () => {
		const ek = item({
			kind: 'stemming',
			subkind: null,
			node: { collection: 'decisions', key: 'ek_1' } as FeedItem['node'],
			dossier: {
				key: '36745',
				number: '36745',
				short_title: 'Wet startprocedure b3-scholen'
			} as never,
			vote: { chamber: 'EK', passed: true, outcome: 'aangenomen', tally: {} } as FeedItem['vote']
		});
		const lines = dayLines(
			day({
				votes: [
					{ chamber: 'EK', subkind: null, outcome: 'aangenomen', count: 1 },
					{ chamber: 'TK', subkind: 'Motie', outcome: 'aangenomen', count: 5 },
					{ chamber: 'TK', subkind: 'Motie', outcome: 'verworpen', count: 3 }
				]
			}),
			[ek]
		);
		expect(lines.map((l) => [l.label, l.title])).toEqual([
			[
				'Eerste Kamer, aangenomen',
				'Eerste Kamer neemt wetsvoorstel aan: Wet startprocedure b3-scholen'
			],
			['Stemmingen', 'Tweede Kamer stemt over 8 moties: 5 aangenomen, 3 verworpen']
		]);
		expect(headlineOf(ek).title).toBe(
			'Eerste Kamer neemt wetsvoorstel aan: Wet startprocedure b3-scholen'
		);
	});

	it('names each vote of a day with few, and bundles none', () => {
		const grinwis = vote(141, 7, {
			persons: [{ surname: 'Grinwis', role: 'indiener' } as never],
			headline: { surname: 'Grinwis', subject: 'steward ownership' }
		});
		const lines = dayLines(
			day({ votes: [{ chamber: 'TK', subkind: 'Motie', outcome: 'aangenomen', count: 1 }] }),
			[grinwis]
		);
		expect(lines.map((l) => [l.title, l.major])).toEqual([
			['Tweede Kamer neemt motie-Grinwis aan over steward ownership', false]
		]);
	});

	it('counts the papers of a day in one line, with the largest dossiers', () => {
		const lines = dayLines(
			day({
				kinds: [
					{ value: 'Motie', count: 54 },
					{ value: 'Amendement', count: 5 },
					{ value: 'Brief regering', count: 14 }
				],
				dossiers: [
					{ kind: 'stemming', number: '29911', short_title: 'Drugsbeleid', count: 30 },
					{ kind: 'Motie', number: '24557', short_title: 'Kansspelen', count: 12 },
					{ kind: 'Motie', number: '31765', short_title: 'Kwaliteit van zorg', count: 7 },
					{ kind: 'Amendement', number: '31765', short_title: 'Kwaliteit van zorg', count: 6 }
				]
			}),
			[]
		);
		expect(lines.map((l) => l.title)).toEqual([
			'Ingediend: 54 moties en 5 amendementen',
			'14 brieven van de regering'
		]);
		expect(lines[0].context).toBe('Kwaliteit van zorg en Kansspelen');
		expect(lines[0].major).toBe(false);
	});

	it('names one kind of paper by itself', () => {
		const [line] = dayLines(day({ kinds: [{ value: 'Motie', count: 21 }] }), []);
		expect(line.label).toBe('Moties');
		expect(line.title).toBe('21 moties ingediend');
	});
});

describe('timelineOf', () => {
	const summary = (days: Day[], items: FeedItem[]): Schema<'FeedSummaryResponse'> => ({
		since: '2026-09-15',
		until: '2026-09-29',
		margin: 10,
		days,
		items,
		items_truncated: false
	});

	it('takes the days with events, newest first, up to the limit', () => {
		const lines = timelineOf(
			summary(
				[
					day({ date: '2026-09-29', total: 0 }),
					day({ date: '2026-09-24', kinds: [{ value: 'Motie', count: 1 }] }),
					day({ date: '2026-09-17' })
				],
				[
					item({
						date: '2026-09-17',
						kind: 'Voorstel van wet',
						dossier: { key: 'w', number: '37014', short_title: 'Wet weerbare waarden' } as never
					})
				]
			),
			10
		);
		expect(lines.map((l) => l.title)).toEqual([
			'1 motie ingediend',
			'Wetsvoorstel ingediend: Wet weerbare waarden'
		]);
	});

	it('keeps what matters of the last day before its counts', () => {
		const lines = timelineOf(
			summary(
				[day({ kinds: [{ value: 'Brief regering', count: 3 }] })],
				[
					item({
						kind: 'toezegging',
						summary: 'De minister stuurt een brief.',
						persons: [{ name: 'Hans Vijlbrief', surname: 'Vijlbrief' } as never]
					})
				]
			),
			1
		);
		expect(lines.map((l) => l.title)).toEqual(['Minister Vijlbrief stuurt een brief.']);
	});
});

describe('headlineOf', () => {
	it('heads one event as the homepage does, major when it matters', () => {
		expect(headlineOf(schilder)).toEqual({
			label: 'Stemming, verworpen',
			vorm: 'besluit',
			title: 'Tweede Kamer verwerpt motie-Schilder over strafverzwaring',
			major: true,
			teken: 'nee'
		});
		expect(headlineOf(vote(120, 30)).major).toBe(false);
		expect(
			headlineOf(
				vote(141, 7, {
					persons: [{ surname: 'Grinwis', role: 'indiener' } as never],
					headline: {
						surname: 'Grinwis',
						subject: 'steward ownership (t.v.v. 21501-30-712)'
					}
				})
			).title
		).toBe('Tweede Kamer neemt motie-Grinwis aan over steward ownership');
		expect(
			headlineOf(
				vote(100, 50, {
					subkind: 'Wetgeving',
					dossier: { key: 'a', number: '36889', short_title: 'Archiefwet' } as never
				})
			)
		).toMatchObject({
			label: 'Wetsvoorstel, aangenomen',
			title: 'Tweede Kamer neemt wetsvoorstel aan: Archiefwet'
		});
		expect(
			headlineOf(item({ kind: 'Brief regering', title: 'Voortgang waterstofbeleid' }))
		).toEqual({
			label: 'Brief regering',
			vorm: 'stuk',
			title: 'Voortgang waterstofbeleid',
			major: false,
			teken: 'stuk'
		});
	});
});

describe('the teken of a line', () => {
	it('is the outcome of a vote, open for a toezegging, a stuk for the rest', () => {
		const ek = item({
			kind: 'stemming',
			node: { collection: 'decisions', key: 'ek_2' } as FeedItem['node'],
			vote: { chamber: 'EK', passed: false, outcome: 'verworpen', tally: {} } as FeedItem['vote']
		});
		const toezegging = item({ kind: 'toezegging', summary: 'De minister stuurt een brief.' });
		const ingediend = item({ kind: 'Voorstel van wet', title: 'Wet x' });
		const lines = dayLines(
			day({
				kinds: [{ value: 'Brief regering', count: 3 }],
				votes: [{ chamber: 'EK', subkind: null, outcome: 'verworpen', count: 1 }]
			}),
			[ek, toezegging, ingediend]
		);
		expect(lines.map((l) => [l.label, l.teken])).toEqual([
			['Eerste Kamer, verworpen', 'nee'],
			['Wetsvoorstel', 'stuk'],
			['Toezegging', 'open'],
			['Brieven', 'stuk']
		]);
	});

	it('of one toezegging in the feed is its state', () => {
		const met = (status: string | null) =>
			headlineOf(item({ kind: 'toezegging', commitment: { status } as never })).teken;
		expect([met('Afgedaan'), met('Vervallen'), met('Openstaand'), met(null)]).toEqual([
			'ja',
			'nee',
			'open',
			'open'
		]);
		expect(headlineOf(vote(100, 50)).teken).toBe('ja');
	});
});

describe('voteHow', () => {
	it('says how a vote without a tally was decided', () => {
		const ek = (method: string) =>
			({ vote: { chamber: 'EK', passed: true, method } }) as Parameters<typeof voteHow>[0];
		expect(voteHow(ek('Stemming bij zitten en opstaan, aangenomen'))).toBe('Bij zitten en opstaan');
		expect(voteHow(ek('Hamerstuk'))).toBe('Hamerstuk');
		const tk = (decision_kind: string) =>
			({ vote: { chamber: 'TK', passed: true, decision_kind } }) as Parameters<typeof voteHow>[0];
		expect(voteHow(tk('Stemmen - zonder stemming aannemen'))).toBe('Hamerstuk');
		expect(voteHow(tk('Stemmen - aangenomen'))).toBeNull();
	});
});

describe('a judgment in the feed', () => {
	it('is cited by its court and the day it was decided, a conclusion by its A-G', () => {
		const item = (judgment: Record<string, unknown>) =>
			({
				id: 'judgments/x',
				kind: 'uitspraak',
				date: '2026-09-23',
				title: 'Raad van State 2026-09-15 / BRS.26.004338',
				node: { collection: 'judgments', key: 'ecli_nl_rvs_2026_5403' },
				persons: [],
				judgment
			}) as unknown as FeedItem;
		expect(
			headlineOf(item({ court: 'RVS', tier: 'raad_van_state', decided_on: '2026-09-15' }))
		).toEqual({
			label: 'Uitspraak',
			title: 'Raad van State, 15 september 2026',
			major: false,
			teken: 'stuk',
			vorm: 'uitspraak'
		});
		const conclusie = headlineOf(
			item({
				court: 'PHR',
				tier: 'parket',
				decided_on: '2018-08-02',
				advocate_general: 'mr. R.E.C.M. Niessen',
				advocate_general_role: 'advocaat-generaal'
			})
		);
		expect(conclusie).toEqual({
			label: 'Conclusie',
			vorm: 'uitspraak',
			title: 'Conclusie A-G Niessen, 2 augustus 2018',
			major: true,
			teken: 'stuk'
		});
	});
});
