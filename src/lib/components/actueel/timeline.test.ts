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
	timelineOf
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
		subkind: 'motie',
		node: { collection: 'decisions', key: `d${n}` } as FeedItem['node'],
		vote: {
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
				subkind: 'wetsvoorstel',
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
					{ subkind: 'wetsvoorstel', outcome: 'aangenomen', count: 2 },
					{ subkind: 'motie', outcome: 'aangenomen', count: 88 },
					{ subkind: 'motie', outcome: 'verworpen', count: 37 },
					{ subkind: 'amendement', outcome: 'aangenomen', count: 9 }
				]
			}),
			[...bills, schilder]
		);
		expect(lines.map((l) => l.title)).toEqual([
			'Kamer neemt twee wetsvoorstellen aan',
			'Kamer verwerpt motie-Schilder over strafverzwaring',
			'Kamer stemt over 125 moties: 88 aangenomen, 37 verworpen'
		]);
		expect(lines[0].context).toBe('wijziging van Wet 36889 en wijziging van Wet 36899');
		expect(lines[1].failed).toBe(true);
		expect(lines[1].context).toBe('75 voor, 75 tegen');
		expect(lines[2].context).toBe('Ook 9 amendementen');
		expect(lines[2].href).toBe('/actueel?van=2026-09-22&tot=2026-09-22&soort=stemming');
	});

	it('names each vote of a day with few, and bundles none', () => {
		const grinwis = vote(141, 7, {
			persons: [{ surname: 'Grinwis', role: 'indiener' } as never],
			headline: { surname: 'Grinwis', subject: 'steward ownership' }
		});
		const lines = dayLines(
			day({ votes: [{ subkind: 'motie', outcome: 'aangenomen', count: 1 }] }),
			[grinwis]
		);
		expect(lines.map((l) => [l.title, l.major])).toEqual([
			['Kamer neemt motie-Grinwis aan over steward ownership', false]
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
			title: 'Kamer verwerpt motie-Schilder over strafverzwaring',
			major: true,
			failed: true
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
		).toBe('Kamer neemt motie-Grinwis aan over steward ownership');
		expect(
			headlineOf(
				vote(100, 50, {
					subkind: 'wetsvoorstel',
					dossier: { key: 'a', number: '36889', short_title: 'Archiefwet' } as never
				})
			)
		).toMatchObject({
			label: 'Wetsvoorstel, aangenomen',
			title: 'Kamer neemt wetsvoorstel aan: Archiefwet'
		});
		expect(
			headlineOf(item({ kind: 'Brief regering', title: 'Voortgang waterstofbeleid' }))
		).toEqual({
			label: 'Brief regering',
			title: 'Voortgang waterstofbeleid',
			major: false
		});
	});
});
